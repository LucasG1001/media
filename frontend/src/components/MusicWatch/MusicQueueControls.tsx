import { TabNav } from "../TabNav/TabNav";
import type { MusicLibraryStatus } from "../../types/musicLibrary";
import { MUSIC_LIBRARY_STATUS_LABELS } from "../../types/musicLibrary";
import type { SortDir } from "../../hooks/useSingleSort";
import styles from "./MusicQueueControls.module.css";

interface MusicQueueControlsProps {
  status: MusicLibraryStatus;
  onStatusChange: (status: MusicLibraryStatus) => void;
  search: string;
  onSearchChange: (value: string) => void;
  sortField: string;
  sortDir: SortDir;
  // Mesmo contrato do `useSingleSort`: escolher o critério ativo inverte a
  // direção, escolher outro troca o critério.
  onSortSelect: (field: string) => void;
}

const STATUS_TABS = (Object.entries(MUSIC_LIBRARY_STATUS_LABELS) as [MusicLibraryStatus, string][]).map(
  ([id, label]) => ({ id, label })
);

const SORT_OPTIONS = [
  { field: "alpha", label: "Alfabética" },
  { field: "date", label: "Data" },
  { field: "views", label: "Visualizações" },
  { field: "access", label: "Último acesso" },
];

// O que recorta e ordena a lista da tela de reprodução. Vive acima dela porque
// Música não tem mais uma tela de biblioteca: é por aqui que se acha uma música.
export function MusicQueueControls({
  status,
  onStatusChange,
  search,
  onSearchChange,
  sortField,
  sortDir,
  onSortSelect,
}: MusicQueueControlsProps) {
  const ascending = sortDir === "asc";

  return (
    <div className={styles.controls}>
      <TabNav
        plain
        tabs={STATUS_TABS}
        activeTab={status}
        onTabChange={(id) => onStatusChange(id as MusicLibraryStatus)}
      />
      <input
        className={styles.search}
        type="search"
        value={search}
        placeholder="Buscar por título ou canal..."
        aria-label="Buscar música"
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <div className={styles.sortRow}>
        <select
          className={styles.sort}
          value={sortField}
          aria-label="Ordenar por"
          onChange={(event) => onSortSelect(event.target.value)}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.field} value={option.field}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.direction}
          onClick={() => onSortSelect(sortField)}
          aria-label="Inverter ordem"
          title={ascending ? "Crescente" : "Decrescente"}
        >
          {ascending ? "↑" : "↓"}
        </button>
      </div>
    </div>
  );
}
