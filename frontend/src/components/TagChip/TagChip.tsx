import { useState, useCallback, useEffect, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useYoutubeTags } from "../../context/youtubeTagContext";
import { useDismiss } from "../../hooks/useDismiss";
import { tagColorVars } from "../../utils/tagColor";
import { TagPicker } from "./TagPicker";
import styles from "./TagChip.module.css";

interface TagChipProps {
  entryId: string;
  collectionId: number | null;
  tag: string | null;
}

const MENU_WIDTH = 200;
const MENU_MAX_HEIGHT = 320;
const MARGIN = 8;

export function TagChip({ entryId, collectionId, tag }: TagChipProps) {
  const { tagsOf, setTag } = useYoutubeTags();
  const [menu, setMenu] = useState<{ left: number; top: number } | null>(null);
  const open = menu !== null;

  const close = useCallback(() => setMenu(null), []);
  useDismiss(open, close);

  useEffect(() => {
    if (!open) return;
    // Menu posicionado por coordenada fixa: qualquer rolagem/resize invalida.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  // Fora de coleção não há vocabulário para escolher: uma tag herdada continua
  // visível, mas não editável. Sem tag e sem coleção, nada é renderizado.
  const editable = collectionId != null;
  if (!tag && !editable) return null;

  const colors = tag ? tagColorVars(tag) : null;
  const label = tag ?? "Sem tag";
  const chipClass = `${styles.chip} ${tag ? "" : styles.ghost} ${editable ? styles.editable : ""}`;
  const chipStyle = colors ? { color: colors.color, background: colors.background } : undefined;

  if (!editable) {
    return (
      <span className={chipClass} style={chipStyle} title={label}>
        {label}
      </span>
    );
  }

  const openMenu = (e: MouseEvent<HTMLButtonElement>) => {
    // O card inteiro é clicável (abre o drawer): o chip precisa se isolar.
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    setMenu({
      left: Math.max(MARGIN, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - MARGIN)),
      top: below < MENU_MAX_HEIGHT + MARGIN ? Math.max(MARGIN, rect.top - MENU_MAX_HEIGHT - 4) : rect.bottom + 4,
    });
  };

  return (
    <>
      <button
        type="button"
        className={chipClass}
        style={chipStyle}
        onClick={openMenu}
        onPointerDown={(e) => e.stopPropagation()}
        title={`${label} — clique para trocar`}
      >
        {label}
      </button>
      {/* Portal: MediaCard tem overflow:hidden e clipa qualquer menu absoluto. */}
      {menu &&
        createPortal(
          <>
            <div className={styles.overlay} onClick={close} />
            <div
              className={styles.menu}
              style={{ left: menu.left, top: menu.top, width: MENU_WIDTH, maxHeight: MENU_MAX_HEIGHT }}
              onClick={(e) => e.stopPropagation()}
            >
              <TagPicker
                tags={tagsOf(collectionId)}
                current={tag}
                onPick={(next) => {
                  if (next !== tag) setTag(entryId, next);
                  close();
                }}
              />
            </div>
          </>,
          document.body
        )}
    </>
  );
}
