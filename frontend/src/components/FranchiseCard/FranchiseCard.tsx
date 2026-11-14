import { MediaCard, type MediaCardConfig } from "../MediaCard/MediaCard";
import { averageScore } from "../../utils/librarySort";
import { latestAccess } from "../../utils/lastAccess";
import styles from "./FranchiseCard.module.css";

export interface MediaGroup<E> {
  key: string;
  representative: E;
  members: E[];
  count: number;
  completedCount: number;
}

interface FranchiseCardProps<
  E extends { status: string; score: number; title: string; lastAccessAt?: string | null },
  T extends { id: number | string }
> {
  group: MediaGroup<E>;
  expanded: boolean;
  onToggle: () => void;
  onCardClick: (card: T) => void;
  onAddToLibrary: (card: T) => void;
  onDelete: () => void;
  libraryEntry?: E;
  index: number;
  cardConfig: MediaCardConfig<T>;
  entryToCard: (entry: E) => T;
  expandTitle: string;
  // Quando true a capa é só a coleção: sem botão de status e o clique
  // expande/recolhe em vez de abrir o detalhe do representante (que segue
  // acessível como membro da expansão).
  coverIsCollectionOnly?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onLongPress?: () => void;
  onToggleSelect?: () => void;
}

export function FranchiseCard<
  E extends { status: string; score: number; title: string; lastAccessAt?: string | null },
  T extends { id: number | string }
>({
  group,
  expanded,
  onToggle,
  onCardClick,
  onAddToLibrary,
  onDelete,
  libraryEntry,
  index,
  cardConfig,
  entryToCard,
  expandTitle,
  coverIsCollectionOnly,
  selectionMode,
  selected,
  onLongPress,
  onToggleSelect,
}: FranchiseCardProps<E, T>) {
  const card = entryToCard(group.representative);
  // Nota exibida = média da coleção (mesmo critério da ordenação por nota), não a
  // nota do representante: sem nenhum membro avaliado a capa não mostra nota. O
  // último acesso segue a mesma ideia, agregando pelo mais recente.
  const displayEntry = libraryEntry
    ? { ...libraryEntry, score: averageScore(group.members), lastAccessAt: latestAccess(group.members) }
    : libraryEntry;

  return (
    <div className={styles.wrapper}>
      <MediaCard
        item={card}
        config={cardConfig}
        libraryEntry={displayEntry}
        onClick={coverIsCollectionOnly ? onToggle : () => onCardClick(card)}
        onAdd={() => onAddToLibrary(card)}
        isLibraryView
        isCollectionCover={coverIsCollectionOnly}
        index={index}
        selectionMode={selectionMode}
        selected={selected}
        onLongPress={onLongPress}
        onToggleSelect={onToggleSelect}
      />
      <button
        className={styles.deleteButton}
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm(`Remover toda a coleção "${group.representative.title}" (${group.count} itens) da biblioteca?`)) onDelete();
        }}
        title="Remover coleção da biblioteca"
        aria-label="Remover coleção da biblioteca"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      </button>
      <button
        className={`${styles.franchiseBadge} ${expanded ? styles.expanded : ""} ${
          coverIsCollectionOnly ? styles.badgeTop : ""
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        title={expanded ? "Recolher coleção" : expandTitle}
      >
        <span className={styles.count}>{group.completedCount}/{group.count}</span>
        <svg className={styles.chevron} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}
