import { useState, useEffect, useCallback } from "react";
import { formatLastAccess, formatLastAccessExact } from "../../utils/lastAccess";
import styles from "./LibraryModalBase.module.css";

// Última vez consumido. `at` nulo = nunca — a linha não aparece.
interface LastAccessConfig {
  label: string;
  at: string | null;
}

// "Assisti/joguei de novo": só faz sentido em item que JÁ estava concluído — é o
// único jeito de a data de último acesso avançar sem transição de status.
interface AgainConfig {
  label: string;
  whenStatus: string;
  onClick: () => void;
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
  lastAccess?: LastAccessConfig;
  again?: AgainConfig;
  onSetCover?: () => void;
  onClose: () => void;
  onSave: (data: { status: string; score: number }) => void;
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
  lastAccess,
  again,
  onSetCover,
  onClose,
  onSave,
  onRemove,
}: LibraryModalBaseProps) {
  const [status, setStatus] = useState(initialStatus);
  const [score, setScore] = useState(initialScore);
  // Vale o status SALVO, não o do seletor: trocando o seletor para concluído sem
  // salvar, quem grava a data é o próprio Salvar (é transição). Item que não está
  // na biblioteca cai fora sozinho — o status inicial dele é o de "planejo".
  const showAgain = again != null && initialStatus === again.whenStatus;

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

          {lastAccess?.at && (
            <div className={styles.lastAccessRow} title={formatLastAccessExact(lastAccess.at)}>
              <span className={styles.controlLabel}>{lastAccess.label}</span>
              <span className={styles.lastAccessValue}>{formatLastAccess(lastAccess.at)}</span>
            </div>
          )}

          {showAgain && (
            <button type="button" className={styles.againButton} onClick={again.onClick}>
              {again.label}
            </button>
          )}

          <div className={styles.actionButtons}>
            <button
              className={styles.saveButton}
              onClick={() => onSave({ status, score })}
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
