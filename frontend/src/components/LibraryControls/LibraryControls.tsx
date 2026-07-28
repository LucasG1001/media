import { useState } from "react";
import { SearchBar } from "../SearchBar/SearchBar";
import { ControlPopover } from "./ControlPopover";
import styles from "./LibraryControls.module.css";

export interface FilterGroupConfig {
  key: string;
  title: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}

export interface SortConfig {
  active: string;
  dir: "desc" | "asc";
  options: { field: string; label: string }[];
  onSelect: (field: string) => void;
}

interface LibraryControlsProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  count: number;
  filterGroups: FilterGroupConfig[];
  onClearFilters: () => void;
  sort?: SortConfig;
}

function SortDirectionIcon({ asc }: { asc: boolean }) {
  return (
    <span className={`${styles.sortIcon} ${asc ? styles.sortIconAsc : ""}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h11M3 12h7M3 18h4M18 8v11m0 0l-3-3m3 3l3-3" />
      </svg>
    </span>
  );
}

export function LibraryControls({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar na biblioteca...",
  count,
  filterGroups,
  onClearFilters,
  sort,
}: LibraryControlsProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const nothingSelected = filterGroups.every((g) => g.selected.length === 0);
  const activeSortLabel = sort?.options.find((o) => o.field === sort.active)?.label ?? "";

  return (
    <div className={styles.bar}>
      <div className={styles.searchWrapper}>
        <SearchBar value={searchValue} onChange={onSearchChange} placeholder={searchPlaceholder} />
      </div>

      {filterGroups.length > 0 && (
      <ControlPopover
        open={filtersOpen}
        onOpen={() => {
          setSortOpen(false);
          setFiltersOpen(true);
        }}
        onClose={() => setFiltersOpen(false)}
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
        }
        label="Filtros"
        panelClassName={styles.filtersPanel}
        headerLeft={
          <button
            type="button"
            className={styles.clearButton}
            onClick={onClearFilters}
            disabled={nothingSelected}
          >
            Limpar tudo
          </button>
        }
      >
        {filterGroups.map((group) => (
          <div key={group.key} className={styles.filterGroup}>
            <span className={styles.filterGroupTitle}>{group.title}</span>
            <div className={styles.filterOptions}>
              {group.options.map((opt) => (
                <label key={opt.value} className={styles.checkbox} title={opt.label}>
                  <input
                    type="checkbox"
                    checked={group.selected.includes(opt.value)}
                    onChange={() => group.onToggle(opt.value)}
                  />
                  <span className={styles.checkboxLabel}>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </ControlPopover>
      )}

      {sort && (
        <ControlPopover
          open={sortOpen}
          onOpen={() => {
            setFiltersOpen(false);
            setSortOpen(true);
          }}
          onClose={() => setSortOpen(false)}
          icon={<SortDirectionIcon asc={sort.dir === "asc"} />}
          label={activeSortLabel}
          title="Ordenação"
        >
          <div className={styles.filterGroup}>
            <div className={styles.checkboxRow}>
              {sort.options.map((opt) => {
                const active = opt.field === sort.active;
                return (
                  <button
                    key={opt.field}
                    type="button"
                    className={`${styles.sortOption} ${active ? styles.sortOptionActive : ""}`}
                    onClick={() => sort.onSelect(opt.field)}
                    title={
                      active
                        ? sort.dir === "desc"
                          ? "Maior/mais recente primeiro"
                          : "Menor/mais antigo primeiro"
                        : undefined
                    }
                  >
                    {active && <SortDirectionIcon asc={sort.dir === "asc"} />}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </ControlPopover>
      )}

      {count > 0 && (
        <span className={styles.count}>
          <span className={styles.countNum}>{count}</span>
          <span className={styles.countWord}>{count === 1 ? " resultado" : " resultados"}</span>
        </span>
      )}
    </div>
  );
}
