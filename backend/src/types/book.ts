// Formas cruas da Hardcover. As colunas `cached_*` são JSONB desnormalizado que a
// própria API mantém: elas evitam join (e nível de aninhamento) para capa, autores,
// série em destaque e gêneros.
export interface HardcoverImage {
  id?: number;
  url?: string;
  color?: string;
  width?: number;
  height?: number;
  color_name?: string;
}

export interface HardcoverAuthorRef {
  id?: number;
  slug?: string;
  name?: string;
}

export interface HardcoverContributor {
  author?: HardcoverAuthorRef | null;
  contribution?: string | null;
}

export interface HardcoverSeriesRef {
  id?: number;
  name?: string;
  slug?: string;
  books_count?: number;
  primary_books_count?: number;
}

export interface HardcoverFeaturedSeries {
  id?: number;
  position?: number | null;
  details?: string | null;
  featured?: boolean;
  series?: HardcoverSeriesRef | null;
}

export interface HardcoverTag {
  tag?: string;
  count?: number;
  tagSlug?: string;
}

export interface HardcoverCachedTags {
  Genre?: HardcoverTag[];
  Mood?: HardcoverTag[];
  Tag?: HardcoverTag[];
}

export interface HardcoverBook {
  id: number;
  slug: string | null;
  title: string | null;
  subtitle?: string | null;
  description?: string | null;
  headline?: string | null;
  pages: number | null;
  release_date: string | null;
  release_year: number | null;
  rating: number | null;
  ratings_count: number | null;
  users_count: number | null;
  cached_image: HardcoverImage | null;
  cached_contributors: HardcoverContributor[] | null;
  cached_featured_series: HardcoverFeaturedSeries | null;
  cached_tags?: HardcoverCachedTags | null;
}

// O `search` devolve o documento cru do Typesense, cujos subcampos não são
// selecionáveis no GraphQL. O `id` vem como string em alguns índices, então quem
// consome converte com Number().
export interface HardcoverSearchDocument {
  id: string | number;
  title?: string;
  slug?: string;
  release_year?: number;
  rating?: number;
  ratings_count?: number;
  users_count?: number;
  author_names?: string[];
  image?: HardcoverImage | null;
  compilation?: boolean;
  featured_series?: HardcoverFeaturedSeries | null;
}

export interface BookPageInfo {
  total: number;
  currentPage: number;
  hasNextPage: boolean;
}

export interface BookCard {
  id: number;
  title: string;
  slug: string | null;
  coverImage: string | null;
  authors: string[];
  // ISO yyyy-mm-dd ou null — nunca só o ano, ao contrário do Google Books. O ano
  // solto vive em `releaseYear`.
  publishedDate: string | null;
  releaseYear: number | null;
  averageRating: number | null;
  ratingsCount: number | null;
  // null quando vem da busca: o documento do Typesense não traz contagem de páginas.
  pageCount: number | null;
  bookStatus: string;
  seriesId: number | null;
  seriesName: string | null;
  seriesPosition: number | null;
}

export interface BookDetail extends BookCard {
  subtitle: string | null;
  // Texto puro na Hardcover (o Google Books devolvia HTML).
  description: string | null;
  headline: string | null;
  usersCount: number | null;
  genres: string[];
}

export interface BookListResult {
  books: BookCard[];
  pageInfo: BookPageInfo;
}

export interface BookSyncResult {
  title: string | null;
  coverImage: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  bookStatus: string;
}
