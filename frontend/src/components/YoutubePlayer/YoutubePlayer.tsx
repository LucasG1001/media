import { useEffect, useRef, useState } from "react";
import { CoverImage } from "../CoverImage/CoverImage";
import {
  loadYoutubeIframeApi,
  YOUTUBE_STATE_ENDED,
  YOUTUBE_STATE_PLAYING,
  type YoutubePlayerHandle,
} from "../../utils/youtubeIframeApi";
import styles from "./YoutubePlayer.module.css";

interface YoutubePlayerProps {
  videoId: string;
  // Fundo da tela de "não dá para tocar aqui".
  thumbnail?: string | null;
  onEnded?: () => void;
  // Dispara a cada vez que o vídeo começa ou volta a tocar.
  onPlaying?: () => void;
}

// Códigos do onError da IFrame API: 100 = removido/privado; 101 e 150 = o dono
// bloqueou a reprodução fora do YouTube (comum em clipe de gravadora). Na
// prática um id que não existe também chega como 150, daí o texto cobrir os dois.
function failureMessage(code: number): string {
  if (code === 100) return "Este vídeo foi removido ou está privado.";
  if (code === 101 || code === 150) {
    return "Este vídeo não pode ser reproduzido fora do YouTube: o dono bloqueou ou ele não está mais disponível.";
  }
  return "Não foi possível reproduzir este vídeo aqui.";
}

// Player do YouTube com os controles nativos (play, volume, qualidade, tela
// cheia) dirigido pela IFrame API: é ela que avisa quando o vídeo acaba ou não
// pode ser tocado. O player é criado uma vez e troca de vídeo por
// `loadVideoById` — recriá-lo a cada música derrubaria a tela cheia.
// O primeiro vídeo entra **pausado** (a página abre nele sem ninguém ter pedido
// para tocar); toda troca depois disso é escolha de alguém e toca na hora.
export function YoutubePlayer({ videoId, thumbnail, onEnded, onPlaying }: YoutubePlayerProps) {
  const mount = useRef<HTMLDivElement>(null);
  const player = useRef<YoutubePlayerHandle | null>(null);
  const ready = useRef(false);
  const wantedId = useRef(videoId);
  const loadedId = useRef<string | null>(null);
  const onEndedRef = useRef(onEnded);
  const onPlayingRef = useRef(onPlaying);
  // A falha é guardada junto com o vídeo a que pertence: trocar de música a
  // desfaz por derivação, sem efeito para limpar estado.
  const [failure, setFailure] = useState<{ videoId: string; code: number } | null>(null);
  const [apiFailed, setApiFailed] = useState(false);

  useEffect(() => {
    onEndedRef.current = onEnded;
    onPlayingRef.current = onPlaying;
  });

  useEffect(() => {
    let cancelled = false;

    loadYoutubeIframeApi()
      .then((api) => {
        const host = mount.current;
        if (cancelled || !host) return;
        // O Player substitui o elemento-alvo pelo iframe; o alvo é criado à mão
        // para o React não ser dono de um nó que vai ser trocado por fora.
        const target = document.createElement("div");
        host.appendChild(target);
        loadedId.current = wantedId.current;
        player.current = new api.Player(target, {
          host: "https://www.youtube-nocookie.com",
          videoId: wantedId.current,
          width: "100%",
          height: "100%",
          playerVars: { autoplay: 0, rel: 0, playsinline: 1 },
          events: {
            onReady: () => {
              ready.current = true;
              if (loadedId.current !== wantedId.current) {
                loadedId.current = wantedId.current;
                player.current?.loadVideoById(wantedId.current);
              }
            },
            onStateChange: (event) => {
              if (event.data === YOUTUBE_STATE_ENDED) onEndedRef.current?.();
              else if (event.data === YOUTUBE_STATE_PLAYING) onPlayingRef.current?.();
            },
            onError: (event) => {
              setFailure({ videoId: loadedId.current ?? wantedId.current, code: event.data });
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setApiFailed(true);
      });

    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
      ready.current = false;
    };
  }, []);

  useEffect(() => {
    wantedId.current = videoId;
    if (!ready.current || loadedId.current === videoId) return;
    loadedId.current = videoId;
    player.current?.loadVideoById(videoId);
  }, [videoId]);

  const failed = failure?.videoId === videoId;
  const message = apiFailed
    ? "Não foi possível carregar o player do YouTube."
    : failed
    ? failureMessage(failure.code)
    : null;

  return (
    <div className={styles.frame}>
      <div className={styles.mount} ref={mount} />
      {message && (
        <div className={styles.unavailable} role="alert">
          <CoverImage className={styles.backdrop} src={thumbnail} alt="" eager />
          <div className={styles.scrim} />
          <div className={styles.card}>
            <div className={styles.icon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="m10 8 6 4-6 4V8Z" />
                <circle cx="12" cy="12" r="10" />
                <path d="m4.9 4.9 14.2 14.2" />
              </svg>
            </div>
            <div className={styles.heading}>Não dá para tocar aqui</div>
            <div className={styles.message}>{message}</div>
            <a
              className={styles.openButton}
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir no YouTube ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
