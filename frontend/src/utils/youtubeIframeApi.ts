export interface YoutubePlayerHandle {
  loadVideoById: (videoId: string) => void;
  destroy: () => void;
}

export interface YoutubePlayerEvent {
  data: number;
}

export interface YoutubePlayerOptions {
  host?: string;
  videoId: string;
  width?: string;
  height?: string;
  playerVars?: Record<string, number | string>;
  events?: {
    onReady?: () => void;
    onStateChange?: (event: YoutubePlayerEvent) => void;
    onError?: (event: YoutubePlayerEvent) => void;
  };
}

export interface YoutubeIframeApi {
  Player: new (element: HTMLElement, options: YoutubePlayerOptions) => YoutubePlayerHandle;
}

declare global {
  interface Window {
    YT?: YoutubeIframeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YOUTUBE_STATE_ENDED = 0;
export const YOUTUBE_STATE_PLAYING = 1;

const SCRIPT_URL = "https://www.youtube.com/iframe_api";

let pending: Promise<YoutubeIframeApi> | null = null;

// O script do YouTube avisa que carregou por um callback global, uma vez só —
// daí a promise compartilhada. Falha de rede zera a promise para a próxima
// tentativa poder carregar de novo.
export function loadYoutubeIframeApi(): Promise<YoutubeIframeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (pending) return pending;

  pending = new Promise<YoutubeIframeApi>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube IFrame API carregou sem o Player."));
    };
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onerror = () => {
      script.remove();
      reject(new Error("Falha ao carregar a YouTube IFrame API."));
    };
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    pending = null;
    throw error;
  });

  return pending;
}
