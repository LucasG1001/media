import { useState, useCallback, useMemo, type ReactNode } from "react";
import { useGridColumns } from "../../hooks/useGridColumns";
import { arrangeRowAwareCells, type RowAwareItem } from "../../utils/rowAwareCells";
import { MediaCard, type MediaCardConfig } from "../MediaCard/MediaCard";
import { FranchiseCard, type MediaGroup } from "../FranchiseCard/FranchiseCard";
import { LoadingSkeleton } from "../LoadingSkeleton/LoadingSkeleton";
import { SelectionBar } from "../SelectionBar/SelectionBar";
import { NameModal } from "../NameModal/NameModal";
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
  // Botão "Último acesso" da barra: revela a data em todos os cards e capas.
  showLastAccess?: boolean;
  animationKey?: string;
  getCollectionKey?: (entry: E) => number | null | undefined;
  onFormGroup?: (ids: string[], name: string) => void | Promise<unknown>;
  onAddToGroup?: (ids: string[], collectionId: number) => void | Promise<unknown>;
  onRemoveFromGroup?: (ids: string[]) => void | Promise<unknown>;
  getCollectionName?: (group: MediaGroup<E>) => string | null;
  onRenameCollection?: (group: MediaGroup<E>, name: string) => void;
  getCollectionExtra?: (group: MediaGroup<E>) => ReactNode;
  // Inversão de controle da expansão: quem recebe decide o que vai antes dos
  // cards e quais membros passa de volta para `renderMembers` (é assim que o
  // filtro de tag do YouTube reduz só a expansão, sem tocar na capa/badge).
  renderExpansion?: (group: MediaGroup<E>, renderMembers: (members: E[]) => ReactNode) => ReactNode;
  // Ações extra da SelectionBar, recebendo os ids selecionados. Só habilitam com
  // os selecionados numa única coleção — tag fora de coleção não existe.
  extraActions?: { label: string; onClick: (ids: string[]) => void }[];
  gridClassName?: string;
  expansionClassName?: string;
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
  showLastAccess,
  animationKey,
  getCollectionKey,
  onFormGroup,
  onAddToGroup,
  onRemoveFromGroup,
  getCollectionName,
  onRenameCollection,
  getCollectionExtra,
  renderExpansion,
  extraActions,
  gridClassName,
  expansionClassName,
}: FranchiseGridProps<E, T>) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [cols, setGridRef] = useGridColumns();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [naming, setNaming] = useState(false);

  const selectionEnabled = !!(statusLabels && onBulkSetStatus);
  const selectionActive = selectionEnabled && selectedIds.size > 0;
  const groupingEnabled = !!getCollectionKey && (!!onFormGroup || !!onAddToGroup || !!onRemoveFromGroup);

  const entryById = useMemo(() => {
    const map = new Map<string, E>();
    for (const group of groups) for (const member of group.members) map.set(member.id, member);
    return map;
  }, [groups]);

  const selectedCollections = useMemo(() => {
    if (!getCollectionKey) return [] as number[];
    const set = new Set<number>();
    selectedIds.forEach((id) => {
      const entry = entryById.get(id);
      const key = entry ? getCollectionKey(entry) : null;
      if (key != null) set.add(key);
    });
    return [...set];
  }, [selectedIds, entryById, getCollectionKey]);

  const canFormGroup = groupingEnabled && !!onFormGroup && selectedCollections.length === 0;
  const canAddToGroup = groupingEnabled && !!onAddToGroup && selectedCollections.length === 1;
  const canRemoveFromGroup = groupingEnabled && !!onRemoveFromGroup && selectedCollections.length >= 1;

  // Uma única coleção **e** nenhum avulso na seleção: a ação extra é a tag em lote,
  // e tag fora de coleção não existe.
  const canUseExtraActions =
    !!extraActions?.length &&
    !!getCollectionKey &&
    selectedCollections.length === 1 &&
    [...selectedIds].every((id) => {
      const entry = entryById.get(id);
      return !!entry && getCollectionKey(entry) != null;
    });

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
    const isCollection = getCollectionKey ? getCollectionKey(group.representative) != null : false;
    if (group.count === 1 && !isCollection) {
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
            showLastAccess={showLastAccess}
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
    const renderMembers = (members: E[]) =>
      members.map((member, memberIndex) => {
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
            showLastAccess={showLastAccess}
            index={memberIndex}
            selectionMode={selectionActive}
            selected={selectedIds.has(member.id)}
            onLongPress={selectionEnabled ? () => toggleIds([member.id]) : undefined}
            onToggleSelect={selectionEnabled ? () => toggleIds([member.id]) : undefined}
          />
        );
      });
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
          showLastAccess={showLastAccess}
          selectionMode={selectionActive}
          selected={memberIds.length > 0 && memberIds.every((id) => selectedIds.has(id))}
          onLongPress={selectionEnabled ? () => toggleIds(memberIds) : undefined}
          onToggleSelect={selectionEnabled ? () => toggleIds(memberIds) : undefined}
          collectionName={getCollectionName ? getCollectionName(group) : undefined}
          onRenameCollection={onRenameCollection ? (name) => onRenameCollection(group, name) : undefined}
          collectionExtra={getCollectionExtra ? getCollectionExtra(group) : undefined}
        />
      ),
      expansion: isExpanded ? (
        <div className={`${styles.expansion} ${expansionClassName ?? ""}`} key={`exp-${group.key}`}>
          {renderExpansion ? renderExpansion(group, renderMembers) : renderMembers(group.members)}
        </div>
      ) : null,
    };
  });

  return (
    <>
      <div className={`${gridStyles.grid} ${gridClassName ?? ""}`} key={animationKey} ref={setGridRef}>
        {arrangeRowAwareCells(items, cols)}
      </div>
      {selectionActive && statusLabels && (
        <SelectionBar
          count={selectedIds.size}
          statusLabels={statusLabels}
          onApply={applyStatus}
          onClear={() => setSelectedIds(new Set())}
          onFormGroup={canFormGroup ? () => setNaming(true) : undefined}
          onAddToGroup={
            canAddToGroup
              ? () => {
                  onAddToGroup?.([...selectedIds], selectedCollections[0]);
                  setSelectedIds(new Set());
                }
              : undefined
          }
          onRemoveFromGroup={
            canRemoveFromGroup
              ? () => {
                  onRemoveFromGroup?.([...selectedIds]);
                  setSelectedIds(new Set());
                }
              : undefined
          }
          extraActions={
            canUseExtraActions
              ? extraActions?.map((action) => ({
                  label: action.label,
                  onClick: () => {
                    action.onClick([...selectedIds]);
                    setSelectedIds(new Set());
                  },
                }))
              : undefined
          }
        />
      )}
      {naming && (
        <NameModal
          title="Nome da coleção"
          placeholder="Ex: Curso de React"
          confirmLabel="Criar grupo"
          onClose={() => setNaming(false)}
          onSubmit={(name) => {
            onFormGroup?.([...selectedIds], name);
            setNaming(false);
            setSelectedIds(new Set());
          }}
        />
      )}
    </>
  );
}
