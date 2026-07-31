import { useState, useCallback } from "react";
import { MediaCard, type MediaCardConfig } from "../MediaCard/MediaCard";
import { LoadingSkeleton } from "../LoadingSkeleton/LoadingSkeleton";
import { SelectionBar } from "../SelectionBar/SelectionBar";
import styles from "./MediaGrid.module.css";

interface MediaGridProps<T extends { id: number | string }, E extends { id: string; status: string; score: number }> {
  items: T[];
  config: MediaCardConfig<T>;
  loading: boolean;
  error: string | null;
  hasNextPage: boolean;
  onLoadMore: () => void;
  onCardClick: (item: T) => void;
  onAddToLibrary: (item: T) => void;
  getLibraryEntry: (id: T["id"]) => E | undefined;
  statusLabels?: Record<string, string>;
  onBulkSetStatus?: (ids: string[], status: string) => void | Promise<unknown>;
  emptyMessage?: string;
  isLibraryView?: boolean;
  animationKey?: string;
}

export function MediaGrid<T extends { id: number | string }, E extends { id: string; status: string; score: number }>({
  items,
  config,
  loading,
  error,
  hasNextPage,
  onLoadMore,
  onCardClick,
  onAddToLibrary,
  getLibraryEntry,
  statusLabels,
  onBulkSetStatus,
  emptyMessage = "Nada encontrado.",
  isLibraryView,
  animationKey,
}: MediaGridProps<T, E>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectionEnabled = !!(isLibraryView && statusLabels && onBulkSetStatus);
  const selectionActive = selectionEnabled && selectedIds.size > 0;

  const [prevAnimationKey, setPrevAnimationKey] = useState(animationKey);
  if (prevAnimationKey !== animationKey) {
    setPrevAnimationKey(animationKey);
    if (selectedIds.size > 0) setSelectedIds(new Set());
  }

  const toggleId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const applyStatus = useCallback(async (status: string) => {
    if (!onBulkSetStatus) return;
    await onBulkSetStatus([...selectedIds], status);
    setSelectedIds(new Set());
  }, [onBulkSetStatus, selectedIds]);

  if (loading && items.length === 0) {
    return <LoadingSkeleton />;
  }

  if (error && items.length === 0) {
    return (
      <div className={styles.grid}>
        <div className={styles.errorState}>
          <div className={styles.emptyIcon}>⚠️</div>
          <div className={styles.emptyTitle}>Ops!</div>
          <div className={styles.emptyText}>{error}</div>
        </div>
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className={styles.grid}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📭</div>
          <div className={styles.emptyTitle}>{emptyMessage}</div>
          <div className={styles.emptyText}>Tente uma busca diferente.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.grid} key={animationKey}>
        {items.map((item, index) => {
          const entry = selectionEnabled ? getLibraryEntry(item.id) : undefined;
          const entryId = entry?.id;
          return (
            <MediaCard
              key={item.id}
              item={item}
              config={config}
              libraryEntry={getLibraryEntry(item.id)}
              onClick={() => onCardClick(item)}
              onAdd={() => onAddToLibrary(item)}
              isLibraryView={isLibraryView}
              index={index}
              selectionMode={selectionActive}
              selected={entryId ? selectedIds.has(entryId) : false}
              onLongPress={selectionEnabled && entryId ? () => toggleId(entryId) : undefined}
              onToggleSelect={selectionEnabled && entryId ? () => toggleId(entryId) : undefined}
            />
          );
        })}

        {hasNextPage && (
          <div className={styles.loadMoreWrapper}>
            <button className={styles.loadMoreButton} onClick={onLoadMore} disabled={loading}>
              {loading ? "Carregando..." : "Carregar mais"}
            </button>
          </div>
        )}
      </div>
      {selectionActive && statusLabels && (
        <SelectionBar
          count={selectedIds.size}
          statusLabels={statusLabels}
          onApply={applyStatus}
          onClear={() => setSelectedIds(new Set())}
        />
      )}
    </>
  );
}
