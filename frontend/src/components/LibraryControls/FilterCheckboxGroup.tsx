import styles from "./LibraryControls.module.css";

export interface FilterGroupConfig {
  key: string;
  title: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}

// Compartilhado entre a barra da biblioteca e o filtro de tag da coleção, para o
// estilo das opções morar num lugar só. `layout`: "grid" alinha as colunas (default,
// para rótulos de larguras muito diferentes); "wrap" põe uma do lado da outra e
// quebra a linha (para rótulos curtos, como as tags).
export function FilterCheckboxGroup({
  group,
  layout = "grid",
}: {
  group: FilterGroupConfig;
  layout?: "grid" | "wrap";
}) {
  return (
    <div className={styles.filterGroup}>
      <span className={styles.filterGroupTitle}>{group.title}</span>
      <div className={layout === "wrap" ? styles.checkboxRow : styles.filterOptions}>
        {group.options.map((opt) => (
          <label key={opt.value} className={styles.checkbox} title={opt.label}>
            <input
              type="checkbox"
              checked={group.selected.includes(opt.value)}
              onChange={() => group.onToggle(opt.value)}
            />
            <span className={styles.checkboxLabel}>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
