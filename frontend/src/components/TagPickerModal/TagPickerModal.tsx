import { useEffect, useCallback } from "react";
import { TagPicker } from "../TagChip/TagPicker";
import styles from "./TagPickerModal.module.css";

interface TagPickerModalProps {
  count: number;
  tags: string[];
  onPick: (tag: string | null) => void;
  onClose: () => void;
}

export function TagPickerModal({ count, tags, onPick, onClose }: TagPickerModalProps) {
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
          Definir tag em {count} {count === 1 ? "vídeo" : "vídeos"}
        </div>
        <TagPicker tags={tags} onPick={onPick} />
        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
