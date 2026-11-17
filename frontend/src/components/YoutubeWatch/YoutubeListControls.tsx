import { useState, type ReactNode } from "react";
import { useDismiss } from "../../hooks/useDismiss";
import type { YoutubeLibraryStatus } from "../../types/youtubeLibrary";
import type { SortDir } from "../../hooks/useSingleSort";
import styles from "./YoutubeListControls.module.css";

interface YoutubeListControlsProps {
  status: YoutubeLibraryStatus;
  onStatusChange: (status: YoutubeLibraryStatus) => void;
  search: string;
  onSearchChange: (value: string) => void;
  sortField: string;
  sortDir: SortDir;
  // Mesmo contrato do `useSingleSort`: escolher o critério ativo inverte a
  // direção, escolher outro troca o critério.
  onSortSelect: (field: string) => void;
  groupByChannel: boolean;
  onGroupByChannelChange: (value: boolean) => void;
  // O bloco de playlists no topo da lista. Não é um agrupamento da lista de
  // baixo: os dois botões são independentes.
  showPlaylists: boolean;
  onShowPlaylistsChange: (value: boolean) => void;
  // Modo de seleção: clicar numa linha marca em vez de tocar.
  selecting: boolean;
  onSelectingChange: (value: boolean) => void;
}

const SORT_OPTIONS = [
  { field: "alpha", label: "Alfabética" },
  { field: "date", label: "Data" },
  { field: "views", label: "Visualizações" },
  { field: "access", label: "Último acesso" },
];

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

// O que recorta, ordena e agrupa a lista da tela de reprodução. Vive acima dela
// porque o YouTube não tem tela de biblioteca: é por aqui que se acha um item.
// Tudo numa linha só — cada linha de controle a mais é um item a menos à vista.
export function YoutubeListControls({
  status,
  onStatusChange,
  search,
  onSearchChange,
  sortField,
  sortDir,
  onSortSelect,
  groupByChannel,
  onGroupByChannelChange,
  showPlaylists,
  onShowPlaylistsChange,
  selecting,
  onSelectingChange,
}: YoutubeListControlsProps) {
  const [sortOpen, setSortOpen] = useState(false);
  useDismiss(sortOpen, () => setSortOpen(false));

  const ascending = sortDir === "asc";
  const direction = ascending ? "crescente" : "decrescente";
  const activeSort = SORT_OPTIONS.find((option) => option.field === sortField);
  const sortSummary = `Ordenar: ${activeSort?.label ?? sortField}, ${direction}`;
  const removed = status === "removed";

  return (
    <div className={styles.controls}>
      <input
        className={styles.search}
        type="search"
        value={search}
        placeholder="Buscar por título ou canal..."
        aria-label="Buscar na biblioteca"
        onChange={(event) => onSearchChange(event.target.value)}
      />

      <div className={styles.sortWrap}>
        <button
          type="button"
          className={`${styles.iconButton} ${sortOpen ? styles.iconButtonOn : ""}`}
          onClick={() => setSortOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={sortOpen}
          aria-label="Ordenar"
          title={sortSummary}
        >
          <Icon>
            <path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" />
          </Icon>
        </button>
        {sortOpen && (
          <>
            <div className={styles.menuOverlay} data-testid="sort-overlay" onClick={() => setSortOpen(false)} />
            {/* Fica aberto depois de escolher: reescolher o critério ativo é o
                que inverte a direção. */}
            <div className={styles.menu} role="menu" aria-label="Ordenar por">
              {SORT_OPTIONS.map((option) => {
                const active = option.field === sortField;
                return (
                  <button
                    key={option.field}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    className={`${styles.menuItem} ${active ? styles.menuItemActive : ""}`}
                    title={active ? `Inverter para ${ascending ? "decrescente" : "crescente"}` : undefined}
                    onClick={() => onSortSelect(option.field)}
                  >
                    <span>{option.label}</span>
                    {active && (
                      <span className={styles.menuDirection} aria-label={direction}>
                        {ascending ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        className={`${styles.iconButton} ${groupByChannel ? styles.iconButtonOn : ""}`}
        onClick={() => onGroupByChannelChange(!groupByChannel)}
        aria-pressed={groupByChannel}
        aria-label="Agrupar por canal"
        title="Agrupar por canal"
      >
        <Icon>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
        </Icon>
      </button>

      <button
        type="button"
        className={`${styles.iconButton} ${showPlaylists ? styles.iconButtonOn : ""}`}
        onClick={() => onShowPlaylistsChange(!showPlaylists)}
        aria-pressed={showPlaylists}
        aria-label="Mostrar playlists"
        title="Mostrar playlists"
      >
        <Icon>
          <path d="M3 6h13M3 12h9M3 18h9M16 13l5 3-5 3z" />
        </Icon>
      </button>

      <button
        type="button"
        className={`${styles.iconButton} ${selecting ? styles.iconButtonOn : ""}`}
        onClick={() => onSelectingChange(!selecting)}
        aria-pressed={selecting}
        aria-label="Selecionar vários"
        title={selecting ? "Sair da seleção" : "Selecionar vários"}
      >
        <Icon>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M8 12l3 3 5-6" />
        </Icon>
      </button>

      <button
        type="button"
        className={`${styles.iconButton} ${removed ? styles.iconButtonOn : ""}`}
        onClick={() => onStatusChange(removed ? "liked" : "removed")}
        aria-pressed={removed}
        aria-label="Mostrar removidos"
        title={removed ? "Mostrando os removidos — voltar para os curtidos" : "Mostrar removidos"}
      >
        <Icon>
          <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
        </Icon>
      </button>
    </div>
  );
}
