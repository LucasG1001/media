export type BookLibraryStatus = "plan_to_read" | "read" | "dropped";

export interface BookLibraryEntry {
  id: string;
  hardcoverId: number;
  title: string;
  coverImage: string | null;
  authors: string | null;
  status: BookLibraryStatus;
  score: number;
  publishedDate: string | null;
  pageCount: number | null;
  bookStatus: string;
  // O id da série da Hardcover.
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

export const BOOK_LIBRARY_STATUS_LABELS: Record<BookLibraryStatus, string> = {
  plan_to_read: "Quero Ler",
  read: "Lido",
  dropped: "Abandonado",
};
