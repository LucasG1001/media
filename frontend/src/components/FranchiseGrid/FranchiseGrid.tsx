import { useState, useCallback } from "react";
import { useGridColumns } from "../../hooks/useGridColumns";
import { arrangeRowAwareCells, type RowAwareItem } from "../../utils/rowAwareCells";
import { MediaCard, type MediaCardConfig } from "../MediaCard/MediaCard";
import { FranchiseCard, type MediaGroup } from "../FranchiseCard/FranchiseCard";
import { LoadingSkeleton } from "../LoadingSkeleton/LoadingSkeleton";
import { SelectionBar } from "../SelectionBar/SelectionBar";
import gridStyles from "../MediaGrid/MediaGrid.module.css";
import styles from "./FranchiseGrid.module.css";

interface FranchiseGridProps<
  E extends { id: string; status: string; score: number; title: string },
  T extends { id: number | string }
> {
  groups: MediaGroup<E>[];
  loading: boolean;
  error: string | null;
  cardConfig: MediaCardConfig<T>;
  entryToCard: (entry: E) => T;
  getExternalId: (entry: E) => T["id"];
  getLibraryEntry: (id: T["id"]) => E | undefined;
  onCardClick: (card: T) => void;
  onAddToLibrary: (card: T) => void;
  onDeleteGroup: (group: MediaGroup<E>) => void;
  statusLabels?: Record<string, string>;
  onBulkSetStatus?: (ids: string[], status: string) => void | Promise<unknown>;
  emptyMessage?: string;
  emptyHint?: string;
  expandTitle: string;
  coverIsCollectionOnly?: boolean;
  animationKey?: string;
}

export function FranchiseGrid<
  E extends { id: string; status: string; score: number; title: string },
  T extends { id: number | string }
>({
  groups,
  loading,
  error,
  cardConfig,
  entryToCard,
  getExternalId,
  getLibraryEntry,
  onCardClick,
  onAddToLibrary,
  onDeleteGroup,
  statusLabels,
  onBulkSetStatus,
  emptyMessage = "Nada encontrado.",
  emptyHint = "Adicione itens para começar!",
  expandTitle,
  coverIsCollectionOnly,
  animationKey,
}: FranchiseGridProps<E, T>) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [cols, setGridRef] = useGridColumns();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectionEnabled = !!(statusLabels && onBulkSetStatus);
  const selectionActive = selectionEnabled && selectedIds.size > 0;

  const [prevAnimationKey, setPrevAnimationKey] = useState(animationKey);
  if (prevAnimationKey !== animationKey) {
    setPrevAnimationKey(animationKey);
    if (selectedIds.size > 0) setSelectedIds(new Set());
  }

  const toggleIds = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allIn = ids.every((id) => next.has(id));
      if (allIn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const applyStatus = useCallback(async (status: string) => {
    if (!onBulkSetStatus) return;
    await onBulkSetStatus([...selectedIds], status);
    setSelectedIds(new Set());
  }, [onBulkSetStatus, selectedIds]);

  const toggle = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  if (loading && groups.length === 0) {
    return <LoadingSkeleton />;
  }

  if (error && groups.length === 0) {
    return (
      <div className={gridStyles.grid}>
        <div className={gridStyles.errorState}>
          <div className={gridStyles.emptyIcon}>⚠️</div>
          <div className={gridStyles.emptyTitle}>Ops!</div>
          <div className={gridStyles.emptyText}>{error}</div>
        </div>
      </div>
    );
  }

  if (!loading && groups.length === 0) {
    return (
      <div className={gridStyles.grid}>
        <div className={gridStyles.emptyState}>
          <div className={gridStyles.emptyIcon}>📭</div>
          <div className={gridStyles.emptyTitle}>{emptyMessage}</div>
          <div className={gridStyles.emptyText}>{emptyHint}</div>
        </div>
      </div>
    );
  }

  const items: RowAwareItem[] = groups.map((group, index) => {
    if (group.count === 1) {
      const card = entryToCard(group.representative);
      const repId = group.representative.id;
      return {
        card: (
          <MediaCard
            key={group.key}
            item={card}
            config={cardConfig}
            libraryEntry={getLibraryEntry(card.id)}
            onClick={() => onCardClick(card)}
            onAdd={() => onAddToLibrary(card)}
            isLibraryView
            index={index}
            selectionMode={selectionActive}
            selected={selectedIds.has(repId)}
            onLongPress={selectionEnabled ? () => toggleIds([repId]) : undefined}
            onToggleSelect={selectionEnabled ? () => toggleIds([repId]) : undefined}
          />
        ),
        expansion: null,
      };
    }

    const isExpanded = expandedKey === group.key;
    const memberIds = group.members.map((m) => m.id);
    return {
      card: (
        <FranchiseCard
          key={group.key}
          group={group}
          expanded={isExpanded}
          onToggle={() => toggle(group.key)}
          onCardClick={onCardClick}
          onAddToLibrary={onAddToLibrary}
          onDelete={() => onDeleteGroup(group)}
          libraryEntry={getLibraryEntry(getExternalId(group.representative))}
          index={index}
          cardConfig={cardConfig}
          entryToCard={entryToCard}
          expandTitle={expandTitle}
          coverIsCollectionOnly={coverIsCollectionOnly}
          selectionMode={selectionActive}
          selected={memberIds.length > 0 && memberIds.every((id) => selectedIds.has(id))}
          onLongPress={selectionEnabled ? () => toggleIds(memberIds) : undefined}
          onToggleSelect={selectionEnabled ? () => toggleIds(memberIds) : undefined}
        />
      ),
      expansion: isExpanded ? (
        <div className={styles.expansion} key={`exp-${group.key}`}>
          {group.members.map((member, memberIndex) => {
            const card = entryToCard(member);
            return (
              <MediaCard
                key={getExternalId(member)}
                item={card}
                config={cardConfig}
                libraryEntry={getLibraryEntry(getExternalId(member))}
                onClick={() => onCardClick(card)}
                onAdd={() => onAddToLibrary(card)}
                isLibraryView
                index={memberIndex}
                selectionMode={selectionActive}
                selected={selectedIds.has(member.id)}
                onLongPress={selectionEnabled ? () => toggleIds([member.id]) : undefined}
                onToggleSelect={selectionEnabled ? () => toggleIds([member.id]) : undefined}
              />
            );
          })}
        </div>
      ) : null,
    };
  });

  return (
    <>
      <div className={gridStyles.grid} key={animationKey} ref={setGridRef}>
        {arrangeRowAwareCells(items, cols)}
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
