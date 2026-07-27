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
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type GameMode = "singleplayer" | "multiplayer" | "coop" | "split_screen" | "mmo" | "battle_royale";

export const GAME_MODE_LABELS: Record<GameMode, string> = {
  singleplayer: "Um jogador",
  multiplayer: "Multiplayer",
  coop: "Cooperativo",
  split_screen: "Tela dividida",
  mmo: "MMO",
  battle_royale: "Battle Royale",
};

export interface CreateGameLibraryEntry {
  igdbId: number;
  title: string;
  backgroundImage?: string | null;
  status?: GameLibraryStatus;
  score?: number;
  released?: string | null;
  metacritic?: number | null;
  gameStatus?: string;
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
}

export const GAME_LIBRARY_STATUS_LABELS: Record<GameLibraryStatus, string> = {
  plan_to_play: "Pretendo Jogar",
  beaten: "Zerado",
  dropped: "Abandonado",
};
