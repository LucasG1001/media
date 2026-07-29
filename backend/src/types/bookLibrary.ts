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

export interface BookLibraryRow {
  id: string;
  google_books_id: string;
  title: string;
  cover_image: string | null;
  authors: string | null;
  status: BookLibraryStatus;
  score: string;
  published_date: string | null;
  page_count: number | null;
  is_cover: boolean;
  notes: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}
