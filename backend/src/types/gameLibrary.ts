export type GameLibraryStatus = "plan_to_play" | "beaten" | "dropped";

export interface GameLibraryEntry {
  id: string;
  igdbId: number;
  title: string;
  backgroundImage: string | null;
  status: GameLibraryStatus;
  score: number;
  released: string | null;
  metacritic: number | null;
  gameStatus: string;
  collectionId: number | null;
  isCover: boolean;
  isRewatching: boolean;
  gameModes: string[] | null;
  syncedAt: string | null;
  notes: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGameLibraryEntry {
  igdbId: number;
  title: string;
  backgroundImage?: string | null;
  status?: GameLibraryStatus;
  score?: number;
  released?: string | null;
  metacritic?: number | null;
  gameStatus?: string;
  collectionId?: number | null;
  gameModes?: string[] | null;
}

export interface UpdateGameLibraryEntry {
  title?: string;
  backgroundImage?: string | null;
  status?: GameLibraryStatus;
  score?: number;
  released?: string | null;
  metacritic?: number | null;
  gameStatus?: string;
  isRewatching?: boolean;
  notes?: string | null;
}

export interface GameSyncData {
  title: string;
  backgroundImage: string | null;
  released: string | null;
  metacritic: number | null;
  gameStatus: string;
}

export interface GameLibraryRow {
  id: string;
  igdb_id: number;
  title: string;
  background_image: string | null;
  status: GameLibraryStatus;
  score: string;
  released: string | null;
  metacritic: number | null;
  game_status: string;
  collection_id: number | null;
  is_cover: boolean;
  is_rewatching: boolean;
  game_modes: string[] | null;
  synced_at: string | null;
  notes: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}
