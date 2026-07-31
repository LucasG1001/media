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
  // Ação própria no ícone (ordenação: inverter a direção, que é o que o ícone já
  // mostra). Divide o gatilho em dois botões irmãos — `<button>` dentro de
  // `<button>` é HTML inválido — sem divisor: continua uma pílula só.
  onIconClick?: () => void;
  iconTitle?: string;
  // Destaca o ícone (Filtros com filtro ativo).
  iconActive?: boolean;
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
  onIconClick,
  iconTitle,
  iconActive,
  children,
}: ControlPopoverProps) {
  useDismiss(open, onClose);
  const iconClass = `${styles.iconWrap} ${iconActive ? styles.iconActive : ""}`;

  return (
    <div className={styles.control}>
      {onIconClick ? (
        <div className={`${styles.toggle} ${styles.toggleSplit}`}>
          <button
            type="button"
            className={`${styles.triggerIcon} ${iconClass}`}
            onClick={onIconClick}
            title={iconTitle}
          >
            {icon}
          </button>
          <button type="button" className={styles.triggerLabel} onClick={onOpen}>
            <span>{label}</span>
          </button>
        </div>
      ) : (
        <button type="button" className={styles.toggle} onClick={onOpen}>
          <span className={iconClass}>{icon}</span>
          <span>{label}</span>
        </button>
      )}
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
