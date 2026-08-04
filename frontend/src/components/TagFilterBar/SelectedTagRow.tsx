import { chipColorVars } from "../../utils/chipColor";
import { NO_TAG, tagLabel } from "./noTag";
import styles from "./TagFilterBar.module.css";

interface SelectedTagRowProps {
  tags: string[];
  onRemove: (tag: string) => void;
  onClear: () => void;
}

// Linha abaixo da busca: o que está filtrado agora. O ✕ aparece no hover — e fica
// sempre visível em dispositivo sem hover, senão não haveria como remover no celular.
export function SelectedTagRow({ tags, onRemove, onClear }: SelectedTagRowProps) {
  if (tags.length === 0) return null;

  return (
    <div className={styles.row}>
      <span className={styles.caption}>Filtrando por</span>
      <div className={styles.chips}>
        {tags.map((tag) => {
          const isNoTag = tag === NO_TAG;
          const { color, background } = chipColorVars(tag);
          return (
            <button
              key={tag}
              type="button"
              className={`${styles.chip} ${styles.selectedChip} ${isNoTag ? styles.noTagChip : ""}`}
              style={isNoTag ? undefined : { color, background }}
              onClick={() => onRemove(tag)}
              title={isNoTag ? "Remover filtro de sem tag" : `Remover ${tag}`}
            >
              <span className={styles.selectedLabel}>{tagLabel(tag)}</span>
              <span className={styles.remove} aria-hidden="true">✕</span>
            </button>
          );
        })}
      </div>
      <button type="button" className={styles.clear} onClick={onClear}>
        Limpar
      </button>
    </div>
  );
}
