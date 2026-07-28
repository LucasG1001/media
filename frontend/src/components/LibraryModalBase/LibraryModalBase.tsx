import { useState, useEffect, useCallback } from "react";
import styles from "./LibraryModalBase.module.css";

interface RewatchConfig {
  label: string;
  whenStatus: string;
  initial: boolean;
}

interface LibraryModalBaseProps {
  title: string;
  coverImage: string | null;
  placeholder: string;
  statusLabels: Record<string, string>;
  initialStatus: string;
  initialScore: number;
  hasEntry: boolean;
  canSetCover?: boolean;
  isCover?: boolean;
  hideScore?: boolean;
  rewatch?: RewatchConfig;
  onSetCover?: () => void;
  onClose: () => void;
  onSave: (data: { status: string; score: number; rewatching?: boolean }) => void;
  onRemove: () => void;
}

export function LibraryModalBase({
  title,
  coverImage,
  placeholder,
  statusLabels,
  initialStatus,
  initialScore,
  hasEntry,
  canSetCover = false,
  isCover = false,
  hideScore = false,
  rewatch,
  onSetCover,
  onClose,
  onSave,
  onRemove,
}: LibraryModalBaseProps) {
  const [status, setStatus] = useState(initialStatus);
  const [score, setScore] = useState(initialScore);
  const [rewatching, setRewatching] = useState(rewatch?.initial ?? false);
  const showRewatch = rewatch != null && status === rewatch.whenStatus;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

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
        <button className={styles.closeButton} onClick={onClose}>✕</button>

        <div className={styles.header}>
          {coverImage ? (
            <img className={styles.coverImage} src={coverImage} alt={title} />
          ) : (
            <div className={styles.coverPlaceholder}>{placeholder}</div>
          )}
          <div className={styles.title}>{title}</div>
        </div>

        <div className={styles.controls}>
          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>Status</span>
            <select
              className={styles.controlSelect}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {Object.entries(statusLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {!hideScore && (
            <div className={styles.controlRow}>
              <span className={styles.controlLabel}>Nota</span>
              <input
                className={styles.controlInput}
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={score}
                onChange={(e) => setScore(Math.min(10, Math.max(0, parseFloat(e.target.value) || 0)))}
              />
            </div>
          )}

          {showRewatch && (
            <button
              type="button"
              className={styles.rewatchRow}
              onClick={() => setRewatching((prev) => !prev)}
              aria-pressed={rewatching}
              role="switch"
              aria-checked={rewatching}
            >
              <span className={styles.rewatchLabel}>{rewatch.label}</span>
              <span className={`${styles.switch} ${rewatching ? styles.switchOn : ""}`}>
                <span className={styles.switchThumb} />
              </span>
            </button>
          )}

          <div className={styles.actionButtons}>
            <button
              className={styles.saveButton}
              onClick={() => onSave({ status, score, rewatching: showRewatch ? rewatching : false })}
            >
              Salvar
            </button>
            {hasEntry && (
              <button className={styles.removeButton} onClick={onRemove}>
                Remover
              </button>
            )}
          </div>

          {canSetCover && (
            <button className={styles.coverButton} onClick={onSetCover} disabled={isCover}>
              {isCover ? "✓ Capa da coleção" : "Definir como capa da coleção"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
