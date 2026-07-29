export type BookLibraryStatus = "plan_to_read" | "read" | "dropped";

export interface BookLibraryEntry {
  id: string;
  googleBooksId: string;
  title: string;
  coverImage: string | null;
  authors: string | null;
  status: BookLibraryStatus;
  score: number;
  publishedDate: string | null;
  pageCount: number | null;
  isCover: boolean;
  notes: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookLibraryEntry {
  googleBooksId: string;
  title: string;
  coverImage?: string | null;
  authors?: string | null;
  status?: BookLibraryStatus;
  score?: number;
  publishedDate?: string | null;
  pageCount?: number | null;
}

export interface UpdateBookLibraryEntry {
  title?: string;
  coverImage?: string | null;
  authors?: string | null;
  status?: BookLibraryStatus;
  score?: number;
  publishedDate?: string | null;
  pageCount?: number | null;
  notes?: string | null;
}

export const BOOK_LIBRARY_STATUS_LABELS: Record<BookLibraryStatus, string> = {
  plan_to_read: "Quero Ler",
  read: "Lido",
  dropped: "Abandonado",
};
