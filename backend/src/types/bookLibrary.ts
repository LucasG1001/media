export type BookLibraryStatus = "plan_to_read" | "read" | "dropped";

export interface BookLibraryEntry {
  id: string;
  hardcoverId: number;
  title: string;
  coverImage: string | null;
  // Vírgula-junto: a Hardcover devolve lista, o banco guarda uma string só.
  authors: string | null;
  status: BookLibraryStatus;
  score: number;
  publishedDate: string | null;
  pageCount: number | null;
  bookStatus: string;
  // O id da SÉRIE da Hardcover — é ele que faz o `collectionColumn` genérico funcionar.
  collectionId: number | null;
  seriesName: string | null;
  seriesPosition: number | null;
  isCover: boolean;
  syncedAt: string | null;
  notes: string | null;
  readAt: string | null;
  lastAccessAt: string | null;
  releaseNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookLibraryEntry {
  hardcoverId: number;
  title: string;
  coverImage?: string | null;
  authors?: string | null;
  status?: BookLibraryStatus;
  score?: number;
  publishedDate?: string | null;
  pageCount?: number | null;
  bookStatus?: string;
  collectionId?: number | null;
  seriesName?: string | null;
  seriesPosition?: number | null;
}

export interface UpdateBookLibraryEntry {
  title?: string;
  coverImage?: string | null;
  authors?: string | null;
  status?: BookLibraryStatus;
  score?: number;
  publishedDate?: string | null;
  pageCount?: number | null;
  bookStatus?: string;
  notes?: string | null;
}

export interface BookSyncData {
  title: string | null;
  coverImage: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  bookStatus: string;
}

export interface BookLibraryRow {
  id: string;
  hardcover_id: number;
  title: string;
  cover_image: string | null;
  authors: string | null;
  status: BookLibraryStatus;
  score: string;
  published_date: string | null;
  page_count: number | null;
  book_status: string;
  collection_id: number | null;
  series_name: string | null;
  // NUMERIC volta como texto do pg.
  series_position: string | null;
  is_cover: boolean;
  synced_at: string | null;
  notes: string | null;
  read_at: string | null;
  last_access_at: string | null;
  release_notified_at: string | null;
  created_at: string;
  updated_at: string;
}
