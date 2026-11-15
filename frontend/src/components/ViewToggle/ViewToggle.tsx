import type { ReactNode } from "react";
import type { LibraryView } from "../../hooks/useLibraryWatch";
import styles from "./ViewToggle.module.css";

export interface ViewOption<T extends string> {
  id: T;
  label: string;
  icon: ReactNode;
}

interface ViewToggleProps<T extends string> {
  options: ViewOption<T>[];
  value: T;
  onChange: (value: T) => void;
  // Nome do grupo para leitor de tela (ex.: "Visualização da biblioteca").
  label: string;
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function GridViewIcon() {
  return (
    <Icon>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Icon>
  );
}

export function DetailViewIcon() {
  return (
    <Icon>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16M18 9h0M18 12h0M18 15h0" />
    </Icon>
  );
}

const LIBRARY_VIEW_OPTIONS: ViewOption<LibraryView>[] = [
  { id: "grid", label: "Grade", icon: <GridViewIcon /> },
  { id: "watch", label: "Detalhe", icon: <DetailViewIcon /> },
];

// O alternador Grade | Detalhe das bibliotecas, para o slot `trailing` da
// `LibraryControls`.
export function LibraryViewToggle({ value, onChange }: { value: LibraryView; onChange: (view: LibraryView) => void }) {
  return (
    <ViewToggle label="Visualização da biblioteca" options={LIBRARY_VIEW_OPTIONS} value={value} onChange={onChange} />
  );
}

// Alterna entre jeitos de ver a mesma lista. Botões lado a lado, um ativo.
export function ViewToggle<T extends string>({ options, value, onChange, label }: ViewToggleProps<T>) {
  return (
    <div className={styles.toggle} role="group" aria-label={label}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            className={`${styles.option} ${active ? styles.optionActive : ""}`}
            onClick={() => onChange(option.id)}
            aria-pressed={active}
            aria-label={option.label}
            title={option.label}
          >
            {option.icon}
          </button>
        );
      })}
    </div>
  );
}
