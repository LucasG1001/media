import type { ReactNode } from "react";
import { useDismiss } from "../../hooks/useDismiss";
import styles from "./LibraryControls.module.css";

interface ControlPopoverProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  icon: ReactNode;
  label: ReactNode;
  headerLeft?: ReactNode;
  title?: string;
  // Largura do painel no desktop: "wide" = fixa no teto; "fit" = cresce com o
  // conteúdo até o teto e só então quebra linha.
  panelWidth?: "wide" | "fit";
  children: ReactNode;
}

export function ControlPopover({
  open,
  onOpen,
  onClose,
  icon,
  label,
  headerLeft,
  title,
  panelWidth,
  children,
}: ControlPopoverProps) {
  useDismiss(open, onClose);

  return (
    <div className={styles.control}>
      <button type="button" className={styles.toggle} onClick={onOpen}>
        {icon}
        <span>{label}</span>
      </button>
      {open && <div className={styles.overlay} onClick={onClose} />}
      <div
        className={`${styles.panel} ${
          panelWidth === "wide" ? styles.widePanel : panelWidth === "fit" ? styles.fitPanel : ""
        } ${open ? styles.panelOpen : ""}`}
      >
        <div className={styles.panelHeader}>
          {headerLeft ?? (title ? <span className={styles.panelTitle}>{title}</span> : <span />)}
          <button type="button" className={styles.close} onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
