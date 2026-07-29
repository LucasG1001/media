import { pool } from "../database/connection.js";
import { createLibraryModel } from "../lib/createLibraryModel.js";
import type { BookLibraryEntry, CreateBookLibraryEntry, UpdateBookLibraryEntry, BookLibraryRow } from "../types/bookLibrary.js";

export const bookLibraryModel = createLibraryModel<BookLibraryEntry, CreateBookLibraryEntry, UpdateBookLibraryEntry>({
  table: "books_library",
  externalId: { column: "google_books_id", field: "googleBooksId" },
  fields: [
    { column: "title", field: "title" },
    { column: "cover_image", field: "coverImage", default: null },
    { column: "authors", field: "authors", default: null },
    { column: "status", field: "status", default: "plan_to_read" },
    { column: "score", field: "score", default: 0, numeric: true },
    { column: "published_date", field: "publishedDate", default: null },
    { column: "page_count", field: "pageCount", default: null },
    { column: "is_cover", field: "isCover", default: false, readonly: true },
    { column: "notes", field: "notes", default: null },
  ],
  statusField: "status",
  completion: { column: "read_at", field: "readAt", whenStatus: "read" },
});

const AUTHOR_KEY_SQL = "trim(regexp_replace(lower(split_part(authors, ',', 1)), '[^a-z0-9]+', ' ', 'g'))";

bookLibraryModel.setCover = async (id: string): Promise<BookLibraryEntry | null> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE books_library SET is_cover = FALSE
       WHERE ${AUTHOR_KEY_SQL} = (SELECT ${AUTHOR_KEY_SQL} FROM books_library WHERE id = $1)
         AND authors IS NOT NULL`,
      [id]
    );
    const result = await client.query<BookLibraryRow>(
      `UPDATE books_library SET is_cover = TRUE WHERE id = $1 RETURNING *`,
      [id]
    );
    await client.query("COMMIT");
    return result.rows[0] ? toEntry(result.rows[0]) : null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

function toEntry(row: BookLibraryRow): BookLibraryEntry {
  return {
    id: row.id,
    googleBooksId: row.google_books_id,
    title: row.title,
    coverImage: row.cover_image,
    authors: row.authors,
    status: row.status,
    score: parseFloat(row.score),
    publishedDate: row.published_date,
    pageCount: row.page_count,
    isCover: row.is_cover,
    notes: row.notes,
    readAt: row.read_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function bulkUpsertBooks(entries: CreateBookLibraryEntry[]): Promise<BookLibraryEntry[]> {
  if (entries.length === 0) return [];

  const values: unknown[] = [];
  const rows: string[] = [];
  let i = 1;

  for (const entry of entries) {
    const statusParam = `$${i + 4}`;
    rows.push(
      `($${i}, $${i + 1}, $${i + 2}, $${i + 3}, ${statusParam}, $${i + 5}, $${i + 6}, $${i + 7}, CASE WHEN ${statusParam} = 'read' THEN NOW() ELSE NULL END)`
    );
    values.push(
      entry.googleBooksId,
      entry.title,
      entry.coverImage ?? null,
      entry.authors ?? null,
      entry.status ?? "plan_to_read",
      entry.score ?? 0,
      entry.publishedDate ?? null,
      entry.pageCount ?? null
    );
    i += 8;
  }

  const result = await pool.query<BookLibraryRow>(
    `INSERT INTO books_library
       (google_books_id, title, cover_image, authors, status, score, published_date, page_count, read_at)
     VALUES ${rows.join(", ")}
     ON CONFLICT (google_books_id) DO NOTHING
     RETURNING *`,
    values
  );
  return result.rows.map(toEntry);
}
