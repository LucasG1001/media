export interface IgdbImageRef {
  id?: number;
  image_id: string;
}

export interface IgdbNamed {
  id: number;
  name: string;
}

export interface IgdbVideo {
  id: number;
  name?: string;
  video_id: string;
}

export interface IgdbWebsite {
  id: number;
  type: number;
  url?: string;
}

export interface IgdbExternalGame {
  id: number;
  external_game_source: number;
  uid: string;
}

export interface IgdbInvolvedCompany {
  id: number;
  company: { id: number; name: string };
  developer: boolean;
  publisher: boolean;
}

export interface IgdbGameListItem {
  id: number;
  name: string;
  cover?: IgdbImageRef | null;
  first_release_date?: number | null;
  total_rating?: number | null;
  aggregated_rating?: number | null;
  websites?: IgdbWebsite[];
}

export interface IgdbGameDetail extends IgdbGameListItem {
  summary?: string | null;
  artworks?: IgdbImageRef[];
  screenshots?: IgdbImageRef[];
  videos?: IgdbVideo[];
  genres?: IgdbNamed[];
  platforms?: IgdbNamed[];
  involved_companies?: IgdbInvolvedCompany[];
  external_games?: IgdbExternalGame[];
  total_rating_count?: number | null;
}

export interface GamePageInfo {
  total: number;
  currentPage: number;
  hasNextPage: boolean;
}

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
  bannerImage: string | null;
  screenshots: string[];
  ratingsCount: number | null;
  steamAppId: string | null;
}

export interface GameListResult {
  games: GameCard[];
  pageInfo: GamePageInfo;
}

export interface IgdbCollectionRef {
  id: number;
  collections?: number[];
}

export interface IgdbCollectionGame extends IgdbGameListItem {
  game_type?: number;
}

export interface IgdbCollection {
  id: number;
  name: string;
  games?: IgdbCollectionGame[];
}
