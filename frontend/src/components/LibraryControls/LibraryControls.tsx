import { useState } from "react";
import { SearchBar } from "../SearchBar/SearchBar";
import { ControlPopover } from "./ControlPopover";
import { FilterCheckboxGroup, type FilterGroupConfig } from "./FilterCheckboxGroup";
import styles from "./LibraryControls.module.css";

export type { FilterGroupConfig };

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
  const [optionQuery, setOptionQuery] = useState("");

  const nothingSelected = filterGroups.every((g) => g.selected.length === 0);
  const activeSortLabel = sort?.options.find((o) => o.field === sort.active)?.label ?? "";

  // Busca única do painel, valendo para as opções de todos os grupos (canal, tag,
  // status...). Só aparece quando há opção o bastante para valer a pena procurar.
  const totalOptions = filterGroups.reduce((sum, g) => sum + g.options.length, 0);
  const q = optionQuery.trim().toLowerCase();
  const nothingMatches =
    q !== "" && !filterGroups.some((g) => g.options.some((o) => o.label.toLowerCase().includes(q)));

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
        onClose={() => {
          setFiltersOpen(false);
          setOptionQuery("");
        }}
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
        }
        label="Filtros"
        panelWidth="wide"
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
        {totalOptions > 10 && (
          <input
            className={styles.filterSearch}
            type="text"
            value={optionQuery}
            placeholder="Buscar filtro..."
            onChange={(e) => setOptionQuery(e.target.value)}
          />
        )}
        {filterGroups.map((group) => (
          <FilterCheckboxGroup key={group.key} group={group} query={optionQuery} />
        ))}
        {nothingMatches && <span className={styles.filterEmpty}>Nada encontrado.</span>}
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
