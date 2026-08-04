import axios from "axios";
import { cachedRequest, httpRequest } from "../lib/httpClient.js";
import { createRateLimiter } from "../lib/rateLimiter.js";
import { chunk } from "../lib/chunk.js";
import type {
  HardcoverBook,
  HardcoverContributor,
  HardcoverSearchDocument,
  BookCard,
  BookDetail,
  BookListResult,
  BookPageInfo,
  BookSyncResult,
} from "../types/book.js";

export class HardcoverError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "HardcoverError";
  }
}

interface GraphQLEnvelope {
  data: unknown;
  errors?: Array<{ message?: string }>;
}

const HARDCOVER_URL = "https://api.hardcover.app/v1/graphql";
const CACHE_TTL_MS = 60 * 60 * 1000;
const PAGE_SIZE = 25;
const SYNC_BATCH_SIZE = 200;

// Filtro de qualidade da busca: leitores mínimos para um registro não ser stub.
const MIN_USERS_COUNT = 20;
// Navegação por gênero recorta no servidor, então o piso é bem mais alto.
const GENRE_MIN_USERS_COUNT = 1000;
// "Genre" na tabela tag_categories da Hardcover (1); as outras categorias são
// Mood/Tag/Content Warning, que não servem de gênero.
const GENRE_TAG_CATEGORY_ID = 1;
// Fração mínima de membros da série que compartilham autor com o livro semeador.
const AUTHOR_OVERLAP_MIN = 0.5;
// Menos que isso não é coleção — mesma regra do animeAdapter.
const MIN_COLLECTION_MEMBERS = 2;

// A Hardcover não devolve nenhum header x-ratelimit-*, então o pacing por header do
// rateLimiter é inerte aqui de propósito: isto é só o throttle de intervalo mínimo
// (60 req/min documentado). O cooldown de 429 do httpClient continua valendo.
const hardcoverLimiter = createRateLimiter({
  minIntervalMs: 350,
  lowRemainingThreshold: 0,
  bufferMs: 0,
});

const BOOK_CARD_FIELDS = `
  id
  slug
  title
  pages
  release_date
  release_year
  rating
  ratings_count
  users_count
  cached_image
  cached_contributors
  cached_featured_series
`;

const BOOK_DETAIL_FIELDS = `
  ${BOOK_CARD_FIELDS}
  subtitle
  description
  headline
  cached_tags
`;

// Deduplicação da série. Não é otimização, é obrigatório: sem isso a série volta com
// traduções ocupando a mesma posição (a edição italiana e a portuguesa de um Mistborn
// duplicam as posições 2 e 3.5). `position: {_is_null: false}` é o que impede o
// distinct_on de colapsar TODOS os livros sem posição num membro arbitrário — o preço
// é que livro sem posição fica FORA da coleção. Um membro faltando é melhor que um errado.
const SERIES_MEMBERS_ARGS = `
  distinct_on: position
  order_by: [{ position: asc }, { book: { users_count: desc } }]
  where: {
    book: { canonical_id: { _is_null: true }, is_partial_book: { _eq: false } }
    compilation: { _eq: false }
    position: { _is_null: false }
  }
`;

async function queryHardcover<T>(
  query: string,
  variables: Record<string, unknown>,
  cached = true
): Promise<T> {
  // Ao contrário do Google Books (que funcionava sem chave), a Hardcover exige o token
  // em TODA consulta, inclusive na busca do catálogo: sem ele nada do domínio funciona.
  const token = process.env.HARDCOVER_API_TOKEN;
  if (!token) throw new HardcoverError("Token da Hardcover não configurado.", 500);

  const config = {
    method: "post" as const,
    url: HARDCOVER_URL,
    data: { query, variables },
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      authorization: `Bearer ${token}`,
      "User-Agent": "StashMediaTracker/1.0",
    },
  };

  let result: T;
  try {
    result = cached
      ? await cachedRequest<T>(config, CACHE_TTL_MS, { limiter: hardcoverLimiter })
      : await httpRequest<T>(config, { limiter: hardcoverLimiter });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      // O token expira em 1 ano (reset em 1º de janeiro) e derruba o domínio inteiro
      // de uma vez: mensagem própria para dar diagnóstico em vez de erro genérico.
      if (status === 401 || status === 403) {
        throw new HardcoverError("Token da Hardcover inválido ou expirado.", 502);
      }
      if (status === 400) throw new HardcoverError("Requisição inválida à Hardcover.", 400);
      throw new HardcoverError("Falha ao consultar a Hardcover.", 502);
    }
    throw error;
  }

  const envelope = result as GraphQLEnvelope;
  if (envelope.errors?.length) throw new HardcoverError("Requisição inválida à Hardcover.", 400);
  if (envelope.data == null) throw new HardcoverError("Requisição inválida à Hardcover.", 400);

  return result;
}

// ---------- normalização ----------

function authorsOf(contributors: HardcoverContributor[] | null | undefined): string[] {
  const names: string[] = [];
  for (const c of contributors ?? []) {
    const name = c.author?.name;
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * Não é o deriveStatus do TMDB: lá data nula significa "sem data marcada ainda", aqui
 * significa "a Hardcover não sabe" e o livro em geral é antigo. Cair em UPCOMING
 * badgearia clássico sem data como "Em breve" e o prenderia para sempre no TTL curto.
 */
export function deriveBookStatus(releaseDate: string | null, releaseYear: number | null): string {
  const now = new Date();
  if (releaseDate) return releaseDate <= now.toISOString().slice(0, 10) ? "RELEASED" : "UPCOMING";
  if (releaseYear != null) return releaseYear <= now.getUTCFullYear() ? "RELEASED" : "UPCOMING";
  return "RELEASED";
}

function toBookCard(book: HardcoverBook): BookCard {
  const featured = book.cached_featured_series;
  return {
    id: book.id,
    title: book.title || "Sem título",
    slug: book.slug,
    coverImage: book.cached_image?.url ?? null,
    authors: authorsOf(book.cached_contributors),
    publishedDate: book.release_date,
    releaseYear: book.release_year,
    averageRating: book.rating,
    ratingsCount: book.ratings_count,
    pageCount: book.pages,
    bookStatus: deriveBookStatus(book.release_date, book.release_year),
    seriesId: featured?.series?.id ?? null,
    seriesName: featured?.series?.name ?? null,
    seriesPosition: featured?.position ?? null,
  };
}

function toBookDetail(book: HardcoverBook): BookDetail {
  return {
    ...toBookCard(book),
    subtitle: book.subtitle ?? null,
    description: book.description ?? null,
    headline: book.headline ?? null,
    usersCount: book.users_count,
    // Gêneros saem de cached_tags.Genre (escalar, já ordenado por popularidade) em vez
    // do join `taggings`, que devolve a mesma tag repetida.
    genres: (book.cached_tags?.Genre ?? [])
      .map((t) => t.tag)
      .filter((t): t is string => !!t),
  };
}

function searchCardFrom(doc: HardcoverSearchDocument): BookCard {
  const featured = doc.featured_series;
  const releaseYear = doc.release_year ?? null;
  return {
    id: Number(doc.id),
    title: doc.title || "Sem título",
    slug: doc.slug ?? null,
    coverImage: doc.image?.url ?? null,
    authors: doc.author_names ?? [],
    // O documento do Typesense não traz a data completa, só o ano.
    publishedDate: null,
    releaseYear,
    averageRating: doc.rating ?? null,
    ratingsCount: doc.ratings_count ?? null,
    pageCount: null,
    bookStatus: deriveBookStatus(null, releaseYear),
    seriesId: featured?.series?.id ?? null,
    seriesName: featured?.series?.name ?? null,
    seriesPosition: featured?.position ?? null,
  };
}

// ---------- busca ----------

/**
 * A ordenação padrão (_text_match desc, users_count desc) acerta a relevância mas põe
 * stub de 3 leitores e paródia no topo; trocar para users_count:desc destrói a
 * relevância ("dune" passa a devolver Jane Eyre). O certo é manter a ordenação padrão,
 * pedir 25 e filtrar aqui — mesmo padrão do cleanVolumes que isto substituiu.
 */
export function isQualityDocument(doc: HardcoverSearchDocument): boolean {
  if ((doc.users_count ?? 0) < MIN_USERS_COUNT) return false;
  if (!doc.image?.url) return false;
  if (!doc.author_names || doc.author_names.length === 0) return false;
  if (doc.compilation) return false;
  return true;
}

function searchDocuments(results: unknown): { found: number; docs: HardcoverSearchDocument[] } {
  const blob = results as { found?: number; hits?: Array<{ document?: HardcoverSearchDocument }> } | null;
  const hits = Array.isArray(blob?.hits) ? blob.hits : [];
  const docs = hits
    .map((h) => h.document)
    .filter((d): d is HardcoverSearchDocument => !!d && d.id != null);
  return { found: blob?.found ?? 0, docs };
}

// hasNextPage sai da contagem CRUA, não da filtrada: o filtro derruba 25 hits para
// 2–10 e lista filtrada vazia não significa fim de resultado.
function toPageInfo(total: number, page: number, rawCount: number): BookPageInfo {
  return { total, currentPage: page, hasNextPage: page * PAGE_SIZE < total && rawCount === PAGE_SIZE };
}

const SEARCH_QUERY = `
  query SearchBooks($query: String!, $perPage: Int!, $page: Int!) {
    search(query: $query, query_type: "Book", per_page: $perPage, page: $page) {
      results
    }
  }
`;

interface SearchEnvelope {
  data: { search: { results: unknown } | null } | null;
}

export async function searchBooks(searchQuery: string, page = 1): Promise<BookListResult> {
  const data = await queryHardcover<SearchEnvelope>(SEARCH_QUERY, {
    query: searchQuery,
    perPage: PAGE_SIZE,
    page,
  });
  const { found, docs } = searchDocuments(data.data?.search?.results);
  return {
    books: docs.filter(isQualityDocument).map(searchCardFrom),
    pageInfo: toPageInfo(found, page, docs.length),
  };
}

// ---------- catálogo por gênero ----------

// O `where` é repetido no aggregate e na página de propósito: hoistar para
// `$where: books_bool_exp!` dependeria de um nome de tipo gerado pelo Hasura.
// canonical_id/is_partial_book/compilation matam tradução, volume parcial e box set no
// servidor, e `id: asc` no order_by é o que estabiliza a paginação por offset.
const GENRE_QUERY = `
  query BooksByGenre($genre: String!, $minUsers: Int!, $limit: Int!, $offset: Int!) {
    books_aggregate(
      where: {
        taggings: { tag: { tag: { _eq: $genre }, tag_category_id: { _eq: ${GENRE_TAG_CATEGORY_ID} } } }
        users_count: { _gt: $minUsers }
        canonical_id: { _is_null: true }
        is_partial_book: { _eq: false }
        compilation: { _eq: false }
      }
    ) {
      aggregate { count }
    }
    books(
      where: {
        taggings: { tag: { tag: { _eq: $genre }, tag_category_id: { _eq: ${GENRE_TAG_CATEGORY_ID} } } }
        users_count: { _gt: $minUsers }
        canonical_id: { _is_null: true }
        is_partial_book: { _eq: false }
        compilation: { _eq: false }
      }
      order_by: [{ users_count: desc }, { id: asc }]
      limit: $limit
      offset: $offset
    ) {
      ${BOOK_CARD_FIELDS}
    }
  }
`;

interface GenreEnvelope {
  data: {
    books_aggregate: { aggregate: { count: number } | null } | null;
    books: HardcoverBook[];
  } | null;
}

export async function fetchBooksByGenre(genre: string, page = 1): Promise<BookListResult> {
  const data = await queryHardcover<GenreEnvelope>(GENRE_QUERY, {
    genre,
    minUsers: GENRE_MIN_USERS_COUNT,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const total = data.data?.books_aggregate?.aggregate?.count ?? 0;
  const books = (data.data?.books ?? []).filter((b) => b.cached_image?.url && b.cached_contributors?.length);
  return {
    books: books.map(toBookCard),
    pageInfo: { total, currentPage: page, hasNextPage: page * PAGE_SIZE < total },
  };
}

// ---------- detalhe ----------

const BOOK_BY_ID_QUERY = `
  query BookById($id: Int!) {
    books(where: { id: { _eq: $id } }, limit: 1) {
      ${BOOK_DETAIL_FIELDS}
    }
  }
`;

interface BooksEnvelope {
  data: { books: HardcoverBook[] } | null;
}

export async function fetchBookById(id: number): Promise<BookDetail> {
  const data = await queryHardcover<BooksEnvelope>(BOOK_BY_ID_QUERY, { id });
  const book = data.data?.books?.[0];
  if (!book) throw new HardcoverError("Livro não encontrado na Hardcover.", 404);
  return toBookDetail(book);
}

// ---------- descoberta de série ----------

const SEED_SERIES_QUERY = `
  query BookFeaturedSeries($id: Int!) {
    books(where: { id: { _eq: $id } }, limit: 1) {
      id
      cached_contributors
      cached_featured_series
    }
  }
`;

const SERIES_MEMBERS_QUERY = `
  query SeriesBooks($seriesId: Int!) {
    series(where: { id: { _eq: $seriesId } }, limit: 1) {
      id
      name
      slug
      book_series(${SERIES_MEMBERS_ARGS}) {
        position
        book {
          ${BOOK_CARD_FIELDS}
        }
      }
    }
  }
`;

interface SeriesEnvelope {
  data: {
    series: Array<{
      id: number;
      name: string | null;
      slug: string | null;
      book_series: Array<{ position: number | null; book: HardcoverBook | null }>;
    }>;
  } | null;
}

function authorKeys(contributors: HardcoverContributor[] | null | undefined): Set<string> {
  const keys = new Set<string>();
  for (const c of contributors ?? []) {
    const name = c.author?.name?.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (name) keys.add(name);
  }
  return keys;
}

/**
 * A Hardcover marca `featured: true` errado às vezes: "1984" (id 379760) aponta para a
 * série 21547 "Rosato and Associates", 11 thrillers jurídicos de Lisa Scottoline. Sem
 * esta trava, adicionar 1984 traria 10 livros alheios como "Quero Ler".
 * `cached_contributors` é escalar, então a comparação não custa requisição nem nível de
 * aninhamento. Medido: 1984 → 9%; Harry Potter/Dune/ASOIAF/Mistborn → 100%; Berserk → 98%.
 * O seed conta a si mesmo no denominador, o que dá a uma série de 2 membros o benefício
 * da dúvida em exatamente 0.5.
 */
export function authorOverlapRatio(seed: Set<string>, memberAuthors: Array<Set<string>>): number {
  if (memberAuthors.length === 0) return 0;
  const matching = memberAuthors.filter((m) => [...m].some((name) => seed.has(name))).length;
  return matching / memberAuthors.length;
}

export async function discoverBookSeries(
  seedId: number
): Promise<{ collectionId: number; members: BookCard[] } | null> {
  const seedData = await queryHardcover<BooksEnvelope>(SEED_SERIES_QUERY, { id: seedId });
  const seed = seedData.data?.books?.[0];
  const seriesRef = seed?.cached_featured_series?.series;
  const seriesId = seriesRef?.id;
  if (!seed || seriesId == null) return null;

  const seriesData = await queryHardcover<SeriesEnvelope>(SERIES_MEMBERS_QUERY, { seriesId });
  const series = seriesData.data?.series?.[0];
  if (!series) return null;

  // A posição e o nome da série vêm da linha de book_series DESTA série, nunca do
  // cached_featured_series de cada membro: um membro pode ter outra série em destaque
  // (um livro de Mistborn cuja featured é "The Cosmere", de 42 livros).
  const members: BookCard[] = [];
  for (const row of series.book_series) {
    if (!row.book) continue;
    members.push({
      ...toBookCard(row.book),
      seriesId: series.id,
      seriesName: series.name,
      seriesPosition: row.position,
    });
  }

  // series.books_count conta linhas cruas, não membros deduplicados (Mistborn Saga:
  // 20 cruas → 14 deduplicadas), então a contagem sai daqui.
  if (members.length < MIN_COLLECTION_MEMBERS) return null;

  const seedAuthors = authorKeys(seed.cached_contributors);
  // Seed sem nenhum contribuidor: a trava não tem como rodar, então passa.
  if (seedAuthors.size > 0) {
    const ratio = authorOverlapRatio(
      seedAuthors,
      series.book_series.map((row) => authorKeys(row.book?.cached_contributors))
    );
    if (ratio < AUTHOR_OVERLAP_MIN) {
      console.log(
        `Série ${seriesId} descartada para o livro ${seedId}: só ${Math.round(ratio * 100)}% dos membros compartilham autor.`
      );
      return null;
    }
  }

  return { collectionId: series.id, members };
}

// ---------- refresh em lote ----------

const SYNC_QUERY = `
  query BooksSync($ids: [Int!]!) {
    books(where: { id: { _in: $ids } }) {
      id
      title
      pages
      release_date
      release_year
      cached_image
    }
  }
`;

export async function fetchBooksSyncData(ids: number[]): Promise<Map<number, BookSyncResult>> {
  const map = new Map<number, BookSyncResult>();
  if (ids.length === 0) return map;

  for (const batch of chunk(ids, SYNC_BATCH_SIZE)) {
    // Sem cache: o conjunto de ids que o findStaleBooks devolve é determinístico, então
    // o cache de 1 h faria o tick seguinte reescrever valores idênticos e só bumpar o
    // synced_at — um no-op silencioso na primeira hora.
    const data = await queryHardcover<BooksEnvelope>(SYNC_QUERY, { ids: batch }, false);
    for (const book of data.data?.books ?? []) {
      map.set(book.id, {
        title: book.title,
        coverImage: book.cached_image?.url ?? null,
        publishedDate: book.release_date,
        pageCount: book.pages,
        bookStatus: deriveBookStatus(book.release_date, book.release_year),
      });
    }
  }
  return map;
}
