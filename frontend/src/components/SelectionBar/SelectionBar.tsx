import styles from "./SelectionBar.module.css";

export interface SelectionAction {
  label: string;
  onClick: () => void;
}

interface SelectionBarProps {
  count: number;
  statusLabels: Record<string, string>;
  onApply: (status: string) => void;
  onClear: () => void;
  onFormGroup?: () => void;
  onAddToGroup?: () => void;
  onRemoveFromGroup?: () => void;
  // Ações extra da mídia (ex.: classificar vídeos do YouTube).
  extraActions?: SelectionAction[];
  formGroupLabel?: string;
  addToGroupLabel?: string;
  removeFromGroupLabel?: string;
}

export function SelectionBar({
  count,
  statusLabels,
  onApply,
  onClear,
  onFormGroup,
  onAddToGroup,
  onRemoveFromGroup,
  extraActions,
  formGroupLabel = "Formar grupo",
  addToGroupLabel = "Adicionar ao grupo",
  removeFromGroupLabel = "Remover do grupo",
}: SelectionBarProps) {
  if (count === 0) return null;
  return (
    <div className={styles.bar} role="toolbar" aria-label="Ações de seleção">
      <button type="button" className={styles.close} onClick={onClear} aria-label="Cancelar seleção">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      <span className={styles.count}>{count} selecionado{count > 1 ? "s" : ""}</span>
      <div className={styles.actions}>
        {Object.entries(statusLabels).map(([status, label]) => (
          <button key={status} type="button" className={styles.statusButton} onClick={() => onApply(status)}>
            {label}
          </button>
        ))}
        {onFormGroup && (
          <button type="button" className={styles.groupButton} onClick={onFormGroup}>
            {formGroupLabel}
          </button>
        )}
        {onAddToGroup && (
          <button type="button" className={styles.groupButton} onClick={onAddToGroup}>
            {addToGroupLabel}
          </button>
        )}
        {extraActions?.map((action) => (
          <button key={action.label} type="button" className={styles.groupButton} onClick={action.onClick}>
            {action.label}
          </button>
        ))}
        {onRemoveFromGroup && (
          <button type="button" className={styles.groupButtonDanger} onClick={onRemoveFromGroup}>
            {removeFromGroupLabel}
          </button>
        )}
      </div>
      <select
        className={styles.select}
        value=""
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__form_group__") onFormGroup?.();
          else if (v === "__add_to_group__") onAddToGroup?.();
          else if (v === "__remove_from_group__") onRemoveFromGroup?.();
          else if (v.startsWith("__extra_")) extraActions?.[Number(v.slice(8))]?.onClick();
          else if (v) onApply(v);
        }}
        aria-label="Ações"
      >
        <option value="" disabled>Ações</option>
        {Object.entries(statusLabels).map(([status, label]) => (
          <option key={status} value={status}>{label}</option>
        ))}
        {onFormGroup && <option value="__form_group__">{formGroupLabel}</option>}
        {onAddToGroup && <option value="__add_to_group__">{addToGroupLabel}</option>}
        {extraActions?.map((action, i) => (
          <option key={action.label} value={`__extra_${i}`}>{action.label}</option>
        ))}
        {onRemoveFromGroup && <option value="__remove_from_group__">{removeFromGroupLabel}</option>}
      </select>
    </div>
  );
}
