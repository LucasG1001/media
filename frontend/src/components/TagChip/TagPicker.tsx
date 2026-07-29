import { useState, useRef } from "react";
import { chipColorVars } from "../../utils/chipColor";
import styles from "./TagPicker.module.css";

interface TagPickerProps {
  // Vocabulário completo (todas as tags em uso na biblioteca).
  allTags: string[];
  // Tags já marcadas. No modo lote vem vazio: lá a ação é escolher uma tag.
  selected: string[];
  onToggle: (tag: string) => void;
  emptyLabel?: string;
}

export function TagPicker({ allTags, selected, onToggle, emptyLabel }: TagPickerProps) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const q = query.trim();
  const lower = q.toLowerCase();

  const shown = q ? allTags.filter((t) => t.toLowerCase().includes(lower)) : allTags;
  // O campo de busca acumula os dois papéis: filtra e cria. "Criar" só aparece
  // quando não há casamento exato, senão duplicaria o que já existe.
  const canCreate = q.length > 0 && !allTags.some((t) => t.toLowerCase() === lower);

  // Sequência navegável pelas setas: "Criar" primeiro (quando existe), depois as
  // tags na ordem exibida.
  const items = canCreate ? [q, ...shown] : shown;
  // Clamp em render em vez de estado: a lista encurta enquanto se digita.
  const active = items.length === 0 ? -1 : Math.min(cursor, items.length - 1);

  const pick = (tag: string) => {
    setQuery("");
    setCursor(0);
    onToggle(tag);
  };

  const move = (delta: number) => {
    if (items.length === 0) return;
    const next = Math.min(Math.max(active + delta, 0), items.length - 1);
    setCursor(next);
    // O índice em `items` inclui o "Criar", que fica fora da lista rolável.
    const optionIndex = canCreate ? next - 1 : next;
    optionRefs.current[optionIndex]?.scrollIntoView({ block: "nearest" });
  };

  return (
    <div className={styles.list}>
      <input
        className={styles.search}
        type="text"
        value={query}
        placeholder="Buscar ou criar tag..."
        maxLength={60}
        autoFocus
        onChange={(e) => {
          setQuery(e.target.value);
          setCursor(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            move(1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            move(-1);
          } else if (e.key === "Enter") {
            if (active >= 0) pick(items[active]);
          } else if (e.key === "Escape" && q) {
            e.stopPropagation();
            setQuery("");
            setCursor(0);
          }
        }}
      />

      {canCreate && (
        <button
          type="button"
          className={`${styles.create} ${active === 0 ? styles.cursor : ""}`}
          onClick={() => pick(q)}
          onMouseEnter={() => setCursor(0)}
        >
          + Criar «{q}»
        </button>
      )}

      <div className={styles.options}>
        {shown.map((tag, i) => {
          const { color, background } = chipColorVars(tag);
          const checked = selected.includes(tag);
          const index = canCreate ? i + 1 : i;
          return (
            <button
              key={tag}
              ref={(el) => {
                optionRefs.current[i] = el;
              }}
              type="button"
              className={`${styles.option} ${checked ? styles.optionActive : ""} ${
                active === index ? styles.cursor : ""
              }`}
              onClick={() => onToggle(tag)}
              onMouseEnter={() => setCursor(index)}
              title={tag}
            >
              <span className={styles.dot} style={{ background: color }} />
              <span className={styles.optionLabel} style={{ color }}>{tag}</span>
              {checked && <span className={styles.check} style={{ background }}>✓</span>}
            </button>
          );
        })}
        {shown.length === 0 && !canCreate && (
          <span className={styles.empty}>{emptyLabel ?? "Nenhuma tag ainda."}</span>
        )}
      </div>
    </div>
  );
}
