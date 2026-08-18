import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import styles from "./TrailerEmbed.module.css";

interface TrailerEmbedProps {
  youtubeId: string;
  // Sobreposto ao player e revelado junto com os controles. Fica DENTRO do
  // elemento que entra em tela cheia, que é o que o faz sobreviver a ela.
  overlay?: ReactNode;
  // Opt-in: só onde o vídeo é o conteúdo. Trailer começando sozinho ao abrir o
  // drawer para ler a sinopse seria estorvo.
  autoPlay?: boolean;
}

export function TrailerEmbed({ youtubeId, overlay, autoPlay = false }: TrailerEmbedProps) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // iOS não implementa tela cheia de elemento (só do <video> nativo), então lá
  // não faz sentido oferecer o botão.
  const [supported] = useState(() => typeof document !== "undefined" && document.fullscreenEnabled);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === wrapper.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = wrapper.current;
    if (!el) return;
    // A tela cheia é do NOSSO contêiner, não do iframe: em tela cheia só o
    // elemento fullscreen e seus descendentes são pintados, e nada pode ser
    // injetado num iframe de outra origem. Expandindo o wrapper, a sobreposição
    // continua visível.
    if (document.fullscreenElement === el) void document.exitFullscreen();
    else void el.requestFullscreen();
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.wrapper} ref={wrapper}>
        <iframe
          className={styles.iframe}
          // fs=0 esconde o botão de tela cheia do player: quem expande é o
          // botão abaixo, senão o iframe viraria o elemento fullscreen e
          // engoliria a sobreposição.
          // O clique que abriu o drawer vale como gesto do usuário, então o
          // autoplay com som costuma passar; se o navegador barrar, o player
          // fica no primeiro quadro e basta dar play.
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?fs=0${autoPlay ? "&autoplay=1" : ""}`}
          title="Trailer"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />

        {/* Fora do grupo de opacidade dos controles: cada seta se revela pelo
            hover dela, não pelo do player inteiro. */}
        {overlay && <div className={styles.overlaySlot}>{overlay}</div>}

        <div className={styles.controls}>
          {supported && (
            <button
              className={styles.fullscreenButton}
              onClick={toggleFullscreen}
              title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            >
              {isFullscreen ? "⤡" : "⤢"}
            </button>
          )}
        </div>
      </div>
      <a
        className={styles.fallback}
        href={`https://www.youtube.com/watch?v=${youtubeId}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Assistir no YouTube ↗
      </a>
    </div>
  );
}
