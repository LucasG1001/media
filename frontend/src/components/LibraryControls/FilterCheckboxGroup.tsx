import styles from "./LibraryControls.module.css";

export interface FilterGroupConfig {
  key: string;
  title: string;
  options: { value: string; label: string; count?: number }[];
  selected: string[];
  onToggle: (value: string) => void;
}

// Grupo longo rola dentro de si: o painel não tem teto de altura e uma lista de
// dezenas de opções empurraria a página.
const SCROLL_FROM = 12;

// Compartilhado por quem monta painel de filtro, para o estilo das opções morar num
// lugar só. `layout`: "grid" alinha as colunas (default, para rótulos de larguras
// muito diferentes); "wrap" põe uma opção do lado da outra e quebra a linha.
// `query` vem do campo de busca do painel, que é único e vale para todos os grupos.
export function FilterCheckboxGroup({
  group,
  layout = "grid",
  query = "",
}: {
  group: FilterGroupConfig;
  layout?: "grid" | "wrap";
  query?: string;
}) {
  const q = query.trim().toLowerCase();
  const options = q ? group.options.filter((o) => o.label.toLowerCase().includes(q)) : group.options;

  // Grupo sem nenhuma opção casando com a busca sai inteiro, com título e tudo.
  if (options.length === 0) return null;

  return (
    <div className={styles.filterGroup}>
      <span className={styles.filterGroupTitle}>{group.title}</span>
      <div
        className={`${layout === "wrap" ? styles.checkboxRow : styles.filterOptions} ${
          options.length > SCROLL_FROM ? styles.scrollable : ""
        }`}
      >
        {options.map((opt) => (
          <label key={opt.value} className={styles.checkbox} title={opt.label}>
            <input
              type="checkbox"
              checked={group.selected.includes(opt.value)}
              onChange={() => group.onToggle(opt.value)}
            />
            <span className={styles.checkboxLabel}>{opt.label}</span>
            {opt.count != null && <span className={styles.checkboxCount}>{opt.count}</span>}
          </label>
        ))}
      </div>
    </div>
  );
}
