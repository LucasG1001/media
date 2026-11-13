import { useState } from "react";
import { useDismiss } from "../../hooks/useDismiss";
import { TIER_BANDS, bandRangeLabel, type TierRowId } from "../../utils/tierList";
import {
  EDITABLE_TIER_ROWS,
  TIER_LABEL_MAX,
  diffTierOverrides,
  type TierOverrides,
  type TierStyle,
  type TierStyleBase,
} from "../../utils/tierStyles";
import styles from "./TierSettingsModal.module.css";

interface TierSettingsModalProps {
  current: Record<TierRowId, TierStyle>;
  defaults: Record<TierRowId, TierStyleBase>;
  onSave: (overrides: TierOverrides) => void;
  onClose: () => void;
}

type Draft = Partial<Record<TierRowId, TierStyleBase>>;

function hintOf(id: TierRowId): string {
  const band = TIER_BANDS.find((b) => b.id === id);
  return band ? bandRangeLabel(band.id) : "Status abandonado";
}

function toDraft(source: Record<TierRowId, TierStyleBase>): Draft {
  const draft: Draft = {};
  for (const id of EDITABLE_TIER_ROWS) draft[id] = { label: source[id].label, color: source[id].color };
  return draft;
}

export function TierSettingsModal({ current, defaults, onSave, onClose }: TierSettingsModalProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(current));
  useDismiss(true, onClose);

  const patch = (id: TierRowId, change: Partial<TierStyleBase>) => {
    setDraft((prev) => {
      const base = prev[id] ?? defaults[id];
      return { ...prev, [id]: { ...base, ...change } };
    });
  };

  const invalid = EDITABLE_TIER_ROWS.some((id) => !draft[id]?.label.trim());

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Editar faixas"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.title}>Editar faixas</div>
        <p className={styles.hint}>
          Nome e cor de cada faixa. As notas que definem a faixa são fixas. Fica salvo neste navegador.
        </p>

        <div className={styles.rows}>
          {EDITABLE_TIER_ROWS.map((id) => {
            const value = draft[id] ?? defaults[id];
            return (
              <div className={styles.row} key={id}>
                <input
                  className={styles.color}
                  type="color"
                  value={value.color}
                  aria-label={`Cor de ${value.label || defaults[id].label}`}
                  onChange={(e) => patch(id, { color: e.target.value })}
                />
                <div className={styles.field}>
                  <input
                    className={styles.input}
                    type="text"
                    value={value.label}
                    maxLength={TIER_LABEL_MAX}
                    placeholder={defaults[id].label}
                    aria-label={`Nome da faixa ${defaults[id].label}`}
                    onChange={(e) => patch(id, { label: e.target.value })}
                  />
                  <span className={styles.range}>{hintOf(id)}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.resetButton} onClick={() => setDraft(toDraft(defaults))}>
            Restaurar padrão
          </button>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.confirmButton}
            disabled={invalid}
            onClick={() => {
              onSave(diffTierOverrides(defaults, draft));
              onClose();
            }}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
