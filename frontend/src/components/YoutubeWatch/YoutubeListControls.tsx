import { TabNav } from "../TabNav/TabNav";
import type { YoutubeLibraryStatus } from "../../types/youtubeLibrary";
import { YOUTUBE_LIBRARY_STATUS_LABELS } from "../../types/youtubeLibrary";
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
}

const STATUS_TABS = (Object.entries(YOUTUBE_LIBRARY_STATUS_LABELS) as [YoutubeLibraryStatus, string][]).map(
  ([id, label]) => ({ id, label })
);

const SORT_OPTIONS = [
  { field: "alpha", label: "Alfabética" },
  { field: "date", label: "Data" },
  { field: "views", label: "Visualizações" },
  { field: "access", label: "Último acesso" },
];

// O que recorta, ordena e agrupa a lista da tela de reprodução. Vive acima dela
// porque o YouTube não tem tela de biblioteca: é por aqui que se acha um item.
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
}: YoutubeListControlsProps) {
  const ascending = sortDir === "asc";

  return (
    <div className={styles.controls}>
      <TabNav
        plain
        tabs={STATUS_TABS}
        activeTab={status}
        onTabChange={(id) => onStatusChange(id as YoutubeLibraryStatus)}
      />
      <input
        className={styles.search}
        type="search"
        value={search}
        placeholder="Buscar por título ou canal..."
        aria-label="Buscar na biblioteca"
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
      <label className={styles.group}>
        <input
          type="checkbox"
          checked={groupByChannel}
          onChange={(event) => onGroupByChannelChange(event.target.checked)}
        />
        Agrupar por canal
      </label>
    </div>
  );
}
