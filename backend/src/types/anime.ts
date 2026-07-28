export interface AniListTitle {
  romaji: string;
  english: string | null;
  native: string | null;
}

export interface AniListCoverImage {
  large: string;
  extraLarge: string;
}

export interface AniListTrailer {
  id: string;
  site: string;
}

export interface AniListStudio {
  name: string;
}

export interface AniListNextAiringEpisode {
  episode: number;
  airingAt: number;
}

export interface AniListStreamingEpisode {
  title: string | null;
  thumbnail: string | null;
  url: string;
  site: string | null;
}

export interface AniListExternalLink {
  url: string;
  site: string;
  icon: string | null;
  color: string | null;
  type: string | null;
}

export interface AniListAnime {
  id: number;
  title: AniListTitle;
  coverImage: AniListCoverImage;
  bannerImage: string | null;
  description: string | null;
  status: string;
  format: string | null;
  episodes: number | null;
  genres: string[];
  studios: { nodes: AniListStudio[] };
  season: string | null;
  seasonYear: number | null;
  averageScore: number | null;
  trailer: AniListTrailer | null;
  nextAiringEpisode: AniListNextAiringEpisode | null;
  externalLinks: AniListExternalLink[];
  // Só pedido na query de detalhe (fetchAnimeById).
  streamingEpisodes?: AniListStreamingEpisode[] | null;
  stats?: {
    scoreDistribution: { amount: number }[] | null;
  } | null;
}

export interface AniListPageInfo {
  total: number;
  currentPage: number;
  lastPage: number;
  hasNextPage: boolean;
}

export interface AniListPage {
  pageInfo: AniListPageInfo;
  media: AniListAnime[];
}

export interface AniListResponse {
  data: {
    Page: AniListPage;
  };
}

export interface AniListSingleResponse {
  data: {
    Media: AniListAnime;
  };
}

export interface AnimeCard {
  id: number;
  title: string;
  coverImage: string;
  status: string;
  format: string | null;
  episodes: number | null;
  averageScore: number | null;
  season: string | null;
  seasonYear: number | null;
  genres: string[];
  nextAiringEpisode: AniListNextAiringEpisode | null;
  streamingLinks: AniListExternalLink[];
}

export interface AnimeDetail extends AnimeCard {
  bannerImage: string | null;
  description: string | null;
  studios: string[];
  trailer: AniListTrailer | null;
  externalLinks: AniListExternalLink[];
  streamingEpisodes: AniListStreamingEpisode[];
  ratingCount?: number;
}

export interface AniListRelationNode {
  id: number;
  type: string;
  format: string | null;
}

export interface AniListRelationEdge {
  relationType: string;
  node: AniListRelationNode;
}

export interface AniListFranchiseNode {
  id: number;
  format: string | null;
  title: AniListTitle;
  coverImage: AniListCoverImage;
  episodes: number | null;
  status: string;
  seasonYear: number | null;
  nextAiringEpisode: AniListNextAiringEpisode | null;
  externalLinks: AniListExternalLink[];
  relations: { edges: AniListRelationEdge[] };
}

export interface AniListFranchiseResponse {
  data: {
    Page: {
      media: AniListFranchiseNode[];
    };
  };
}
