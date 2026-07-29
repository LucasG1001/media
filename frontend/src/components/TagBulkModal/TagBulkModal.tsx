import { useEffect, useCallback } from "react";
import { TagPicker } from "../TagChip/TagPicker";
import styles from "./TagBulkModal.module.css";

export type TagBulkMode = "add" | "remove";

interface TagBulkModalProps {
  mode: TagBulkMode;
  count: number;
  // No modo remover, só as tags presentes nos selecionados.
  allTags: string[];
  onPick: (tag: string) => void;
  onClose: () => void;
}

export function TagBulkModal({ mode, count, allTags, onPick, onClose }: TagBulkModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>
          {mode === "add" ? "Adicionar tag em" : "Remover tag de"} {count}{" "}
          {count === 1 ? "vídeo" : "vídeos"}
        </div>
        <TagPicker
          allTags={allTags}
          selected={[]}
          onToggle={onPick}
          emptyLabel={mode === "add" ? "Nenhuma tag ainda — digite para criar." : "Os selecionados não têm tag."}
        />
        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
