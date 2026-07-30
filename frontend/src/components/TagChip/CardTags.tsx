import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useYoutubeTags } from "../../context/youtubeTagContext";
import { useDismiss } from "../../hooks/useDismiss";
import { chipColorVars } from "../../utils/chipColor";
import { TagPicker } from "./TagPicker";
import { TagSuggestions } from "./TagSuggestions";
import styles from "./CardTags.module.css";

interface CardTagsProps {
  entryId: string;
  tags: string[];
}

const MENU_WIDTH = 240;
const MENU_MAX_HEIGHT = 320;
const MARGIN = 8;
// Espaço mínimo embaixo para abrir para baixo: menu + faixa de sugestão.
const STACK_MIN_HEIGHT = MENU_MAX_HEIGHT + 80;

export function CardTags({ entryId, tags }: CardTagsProps) {
  const { allTags, tagRank, recommendFor, setTags } = useYoutubeTags();
  const anchorRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const open = menu !== null;

  const close = useCallback(() => setMenu(null), []);
  useDismiss(open, close);

  // Posição vem do retângulo da âncora, em coordenada de viewport (a pilha é fixed).
  // Sem espaço embaixo, ancora pelo **rodapé** acima da linha de chips: assim a
  // faixa de sugestão cresce para cima sem precisar medir a altura dela.
  const place = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const room = window.innerHeight - rect.bottom;
    setMenu({
      left: Math.max(MARGIN, Math.min(rect.left, window.innerWidth - MENU_WIDTH - MARGIN)),
      ...(room < STACK_MIN_HEIGHT
        ? { bottom: Math.max(MARGIN, window.innerHeight - rect.top + 4) }
        : { top: rect.bottom + 4 }),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    // Reposiciona em vez de fechar: fechar no scroll matava a rolagem da própria
    // lista do menu e o texto sendo digitado na busca.
    let frame = 0;
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && stackRef.current?.contains(e.target)) return;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        place();
      });
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const toggle = (tag: string) => {
    setTags(entryId, tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);
  };

  // Chip mais usado primeiro (empate em ordem alfabética): com o corte de 2 linhas,
  // o que fica escondido passa a ser sempre a tag menos relevante.
  const ordered = [...tags].sort(
    (a, b) => (tagRank.get(a) ?? Infinity) - (tagRank.get(b) ?? Infinity)
  );

  return (
    <>
      {/* A linha inteira abre o menu: um "+" no fim seria escondido pelo corte de
          2 linhas. O card todo é clicável (abre o drawer), daí o stopPropagation. */}
      <div
        ref={anchorRef}
        className={styles.row}
        role="button"
        tabIndex={0}
        title="Clique para editar as tags"
        onClick={(e) => {
          e.stopPropagation();
          if (open) close();
          else place();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            e.preventDefault();
            place();
          }
        }}
      >
        {ordered.length === 0 ? (
          <span className={`${styles.chip} ${styles.ghost}`}>+ tags</span>
        ) : (
          ordered.map((tag) => {
            const { color, background } = chipColorVars(tag);
            return (
              <span key={tag} className={styles.chip} style={{ color, background }} title={tag}>
                {tag}
              </span>
            );
          })
        )}
      </div>

      {/* Portal: MediaCard tem overflow:hidden e clipa qualquer menu absoluto. */}
      {menu &&
        createPortal(
          <>
            <div className={styles.overlay} onClick={close} />
            <div
              ref={stackRef}
              className={styles.stack}
              style={{ left: menu.left, top: menu.top, bottom: menu.bottom, width: MENU_WIDTH }}
              onClick={(e) => e.stopPropagation()}
              // Evento de portal sobe pela árvore React: sem isso o Enter digitado
              // na busca chega no `onKeyDown` do MediaCard e abre o drawer. Escape
              // segue passando, senão o useDismiss não fecharia o menu.
              onKeyDown={(e) => {
                if (e.key !== "Escape") e.stopPropagation();
              }}
            >
              <TagSuggestions tags={recommendFor(tags)} onPick={toggle} />
              <div className={styles.menu} style={{ maxHeight: MENU_MAX_HEIGHT }}>
                <TagPicker allTags={allTags} selected={tags} onToggle={toggle} />
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
