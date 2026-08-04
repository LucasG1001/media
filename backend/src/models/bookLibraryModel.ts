import { pool } from "../database/connection.js";
import { createLibraryModel } from "../lib/createLibraryModel.js";
import type {
  BookLibraryEntry,
  CreateBookLibraryEntry,
  UpdateBookLibraryEntry,
  BookLibraryRow,
  BookSyncData,
} from "../types/bookLibrary.js";

export const bookLibraryModel = createLibraryModel<BookLibraryEntry, CreateBookLibraryEntry, UpdateBookLibraryEntry>({
  table: "books_library",
  externalId: { column: "hardcover_id", field: "hardcoverId" },
  fields: [
    { column: "title", field: "title" },
    { column: "cover_image", field: "coverImage", default: null },
    { column: "authors", field: "authors", default: null },
    { column: "status", field: "status", default: "plan_to_read" },
    { column: "score", field: "score", default: 0, numeric: true },
    { column: "published_date", field: "publishedDate", default: null },
    { column: "page_count", field: "pageCount", default: null },
    { column: "book_status", field: "bookStatus", default: "RELEASED" },
    { column: "collection_id", field: "collectionId", default: null },
    // Só a descoberta de coleção escreve estas duas. A posição é POR série, e a série em
    // destaque de um membro pode ser outra (um Mistborn cuja featured é "The Cosmere"),
    // então drawer e job de refresh não podem tocá-las sob risco de embaralhar a expansão.
    { column: "series_name", field: "seriesName", default: null, readonly: true },
    { column: "series_position", field: "seriesPosition", default: null, numeric: true, readonly: true },
    { column: "is_cover", field: "isCover", default: false, readonly: true },
    { column: "synced_at", field: "syncedAt", default: null, readonly: true },
    { column: "release_notified_at", field: "releaseNotifiedAt", default: null, readonly: true },
    { column: "notes", field: "notes", default: null },
  ],
  statusField: "status",
  completion: { column: "read_at", field: "readAt", whenStatus: "read" },
  lastAccess: { column: "last_access_at", field: "lastAccessAt" },
  collectionColumn: "collection_id",
});

function toEntry(row: BookLibraryRow): BookLibraryEntry {
  return {
    id: row.id,
    hardcoverId: row.hardcover_id,
    title: row.title,
    coverImage: row.cover_image,
    authors: row.authors,
    status: row.status,
    score: parseFloat(row.score),
    publishedDate: row.published_date,
    pageCount: row.page_count,
    bookStatus: row.book_status,
    collectionId: row.collection_id,
    seriesName: row.series_name,
    seriesPosition: row.series_position == null ? null : parseFloat(row.series_position),
    isCover: row.is_cover,
    syncedAt: row.synced_at,
    notes: row.notes,
    readAt: row.read_at,
    lastAccessAt: row.last_access_at,
    releaseNotifiedAt: row.release_notified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// TTL curto para não lançados (a data pode ser adiada) e longo para lançados, que só
// mudam título/capa. Sem `limit`, ao contrário de filmes: a Hardcover aceita lote
// (`id: {_in: [...]}`), então o backfill inteiro cabe em poucas requisições.
export async function findStaleBooks(
  upcomingTtlHours: number,
  releasedTtlHours: number
): Promise<BookLibraryEntry[]> {
  const result = await pool.query<BookLibraryRow>(
    `SELECT * FROM books_library
     WHERE status != 'dropped'
       AND (
         synced_at IS NULL
         OR (book_status = 'UPCOMING' AND synced_at < NOW() - ($1 || ' hours')::interval)
         OR (book_status != 'UPCOMING' AND synced_at < NOW() - ($2 || ' hours')::interval)
       )
     ORDER BY synced_at ASC NULLS FIRST`,
    [upcomingTtlHours, releasedTtlHours]
  );
  return result.rows.map(toEntry);
}

// Título/capa usam COALESCE(NULLIF(...)): um job silencioso não pode trocar um valor bom
// por vazio. Nenhuma coluna de série aqui — ver o `readonly` na config acima.
export async function updateBookSyncData(hardcoverId: number, data: BookSyncData): Promise<void> {
  await pool.query(
    `UPDATE books_library
     SET title = COALESCE(NULLIF($2, ''), title),
         cover_image = COALESCE(NULLIF($3, ''), cover_image),
         published_date = COALESCE($4, published_date),
         page_count = COALESCE($5, page_count),
         book_status = $6,
         synced_at = NOW()
     WHERE hardcover_id = $1`,
    [hardcoverId, data.title ?? null, data.coverImage ?? null, data.publishedDate ?? null, data.pageCount ?? null, data.bookStatus]
  );
}

export async function bulkUpsertBooks(
  entries: CreateBookLibraryEntry[],
  collectionId: number
): Promise<BookLibraryEntry[]> {
  if (entries.length === 0) return [];

  const values: unknown[] = [];
  const rows: string[] = [];
  let i = 1;

  for (const entry of entries) {
    const statusParam = `$${i + 4}`;
    const completedCase = `CASE WHEN ${statusParam} = 'read' THEN NOW() ELSE NULL END`;
    rows.push(
      `($${i}, $${i + 1}, $${i + 2}, $${i + 3}, ${statusParam}, $${i + 5}, $${i + 6}, $${i + 7}, $${i + 8}, $${i + 9}, $${i + 10}, $${i + 11}, ${completedCase}, ${completedCase})`
    );
    values.push(
      entry.hardcoverId,
      entry.title,
      entry.coverImage ?? null,
      entry.authors ?? null,
      entry.status ?? "plan_to_read",
      entry.score ?? 0,
      entry.publishedDate ?? null,
      entry.pageCount ?? null,
      entry.bookStatus ?? "RELEASED",
      collectionId,
      entry.seriesName ?? null,
      entry.seriesPosition ?? null
    );
    i += 12;
  }

  // O COALESCE cobre também as duas colunas de série (filmes só cobrem collection_id):
  // é assim que um livro adicionado avulso antes da série ser descoberta ganha o
  // metadado depois, sem nunca sobrescrever valor já posto por outra descoberta correta.
  const result = await pool.query<BookLibraryRow>(
    `INSERT INTO books_library
       (hardcover_id, title, cover_image, authors, status, score, published_date, page_count,
        book_status, collection_id, series_name, series_position, read_at, last_access_at)
     VALUES ${rows.join(", ")}
     ON CONFLICT (hardcover_id) DO UPDATE SET
       collection_id = COALESCE(books_library.collection_id, EXCLUDED.collection_id),
       series_name = COALESCE(books_library.series_name, EXCLUDED.series_name),
       series_position = COALESCE(books_library.series_position, EXCLUDED.series_position)
     RETURNING *`,
    values
  );
  return result.rows.map(toEntry);
}
