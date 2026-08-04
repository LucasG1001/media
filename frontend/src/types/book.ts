export interface BookCard {
  id: number;
  title: string;
  slug: string | null;
  coverImage: string | null;
  authors: string[];
  // ISO yyyy-mm-dd ou null — nunca só o ano. O ano solto vive em `releaseYear`.
  publishedDate: string | null;
  releaseYear: number | null;
  // 0–5 na Hardcover, não 0–10 como as notas das outras mídias.
  averageRating: number | null;
  ratingsCount: number | null;
  pageCount: number | null;
  bookStatus: string;
  seriesId: number | null;
  seriesName: string | null;
  seriesPosition: number | null;
}

export interface BookDetail extends BookCard {
  subtitle: string | null;
  // Texto puro na Hardcover.
  description: string | null;
  headline: string | null;
  usersCount: number | null;
  genres: string[];
}

export interface PageInfo {
  total: number;
  currentPage: number;
  hasNextPage: boolean;
}

export interface BookListResponse {
  books: BookCard[];
  pageInfo: PageInfo;
}
