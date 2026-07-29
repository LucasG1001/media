import { useState } from "react";
import { tagColorVars } from "../../utils/tagColor";
import styles from "./TagPicker.module.css";

interface TagPickerProps {
  tags: string[];
  // undefined = seleção múltipla (nenhuma opção marcada); null = "Sem tag" marcado.
  current?: string | null;
  onPick: (tag: string | null) => void;
}

export function TagPicker({ tags, current, onPick }: TagPickerProps) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");

  const submitNew = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setDraft("");
    setCreating(false);
    // Reusa a grafia existente quando o nome já existe ignorando caixa, para não
    // criar "Animação" e "animação" como tags diferentes.
    onPick(tags.find((t) => t.toLowerCase() === trimmed.toLowerCase()) ?? trimmed);
  };

  return (
    <div className={styles.list}>
      <button
        type="button"
        className={`${styles.option} ${current === null ? styles.optionActive : ""}`}
        onClick={() => onPick(null)}
      >
        <span className={styles.ghostDot} />
        <span className={styles.optionLabel}>Sem tag</span>
        {current === null && <span className={styles.check}>✓</span>}
      </button>

      {tags.map((tag) => {
        const { color, background } = tagColorVars(tag);
        return (
          <button
            key={tag}
            type="button"
            className={`${styles.option} ${current === tag ? styles.optionActive : ""}`}
            onClick={() => onPick(tag)}
            title={tag}
          >
            <span className={styles.dot} style={{ background: color }} />
            <span className={styles.optionLabel} style={{ color }}>{tag}</span>
            {current === tag && <span className={styles.check} style={{ background }}>✓</span>}
          </button>
        );
      })}

      {creating ? (
        <input
          className={styles.input}
          type="text"
          value={draft}
          placeholder="Nome da tag"
          maxLength={60}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitNew();
            else if (e.key === "Escape") {
              e.stopPropagation();
              setDraft("");
              setCreating(false);
            }
          }}
          onBlur={submitNew}
        />
      ) : (
        <button type="button" className={styles.newButton} onClick={() => setCreating(true)}>
          + Nova tag…
        </button>
      )}
    </div>
  );
}
