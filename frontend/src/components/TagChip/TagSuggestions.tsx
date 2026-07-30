import { chipColorVars } from "../../utils/chipColor";
import styles from "./TagSuggestions.module.css";

interface TagSuggestionsProps {
  tags: string[];
  onPick: (tag: string) => void;
}

// Faixa acima do menu de tag. Some quando não há o que sugerir (combinação que
// nenhum outro vídeo tem) — cair para um fallback ali sugeriria coisa não
// relacionada e confundiria.
export function TagSuggestions({ tags, onPick }: TagSuggestionsProps) {
  if (tags.length === 0) return null;

  return (
    <div className={styles.panel}>
      <span className={styles.caption}>Sugestões</span>
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
              title={`Adicionar ${tag}`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
