import { chipColorVars } from "../../utils/chipColor";
import styles from "./TagFilterBar.module.css";

interface TagSuggestionRowProps {
  tags: string[];
  onPick: (tag: string) => void;
  hasFilter: boolean;
}

// Faixa fixa acima da busca: as tags que mais acompanham as já filtradas. Sem
// filtro, são as mais usadas da biblioteca. Some quando não há o que sugerir
// (biblioteca sem tag, ou combinação que esgotou as companheiras) — mesma regra da
// faixa do card.
export function TagSuggestionRow({ tags, onPick, hasFilter }: TagSuggestionRowProps) {
  if (tags.length === 0) return null;

  return (
    <div className={styles.row}>
      <span className={styles.caption}>{hasFilter ? "Refinar com" : "Filtrar por"}</span>
      <div className={styles.chips}>
        {tags.map((tag) => {
          const { color, background } = chipColorVars(tag);
          return (
            <button
              key={tag}
              type="button"
              className={styles.chip}
              style={{ color, background }}
              onClick={() => onPick(tag)}
              title={`Filtrar por ${tag}`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
