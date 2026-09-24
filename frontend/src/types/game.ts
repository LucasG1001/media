export interface GameStore {
  name: string;
  url: string;
  slug: string;
}

export interface GameTrailer {
  youtubeId: string;
}

export interface GameCard {
  id: number;
  title: string;
  backgroundImage: string | null;
  released: string | null;
  rating: number | null;
  metacritic: number | null;
  gameStatus: string;
  storeSlugs: string[];
}

export interface GameDetail extends GameCard {
  summary: string | null;
  description: string | null;
  website: string | null;
  developers: string[];
  publishers: string[];
  platforms: string[];
  genres: string[];
  esrb: string | null;
  stores: GameStore[];
  trailer: GameTrailer | null;
  // Opcional: detalhe salvo no detail_cache antes deste campo existir não o tem.
  bannerImage?: string | null;
  screenshots: string[];
  ratingsCount: number | null;
  steamAppId: string | null;
}

export interface PageInfo {
  total: number;
  currentPage: number;
  hasNextPage: boolean;
}

export interface GameListResponse {
  games: GameCard[];
  pageInfo: PageInfo;
}
