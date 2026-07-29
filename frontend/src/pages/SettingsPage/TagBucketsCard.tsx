import { useState } from "react";
import { useAppSetting } from "../../hooks/useAppSetting";
import { DEFAULT_TAG_BUCKETS, TAG_BUCKETS_KEY, type TagBucket } from "../../types/youtubeLibrary";
import styles from "./SettingsPage.module.css";

const ROWS = 4;

interface Row {
  label: string;
  top: string;
}

function toRows(buckets: TagBucket[]): Row[] {
  const rows: Row[] = [];
  // A última linha é sempre o "restante" (sem número), então as numeradas ficam nas
  // primeiras posições e a de resto vai para o fim.
  const numbered = buckets.filter((b) => b.top != null);
  const rest = buckets.find((b) => b.top == null);
  for (let i = 0; i < ROWS - 1; i++) {
    const bucket = numbered[i];
    rows.push({ label: bucket?.label ?? "", top: bucket?.top != null ? String(bucket.top) : "" });
  }
  rows.push({ label: rest?.label ?? "", top: "" });
  return rows;
}

export function TagBucketsCard() {
  const { value, loaded, save } = useAppSetting<TagBucket[]>(TAG_BUCKETS_KEY, DEFAULT_TAG_BUCKETS);
  const [rows, setRows] = useState<Row[]>(() => toRows(value));
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Sincroniza quando a config chega do banco (ajuste de estado em render, mesmo
  // padrão do `prevAnimationKey` do FranchiseGrid).
  const [syncedValue, setSyncedValue] = useState(value);
  if (loaded && syncedValue !== value) {
    setSyncedValue(value);
    setRows(toRows(value));
  }

  const setRow = (index: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const handleSave = async () => {
    const buckets: TagBucket[] = [];
    let previous = 0;

    for (const row of rows.slice(0, ROWS - 1)) {
      const label = row.label.trim();
      const raw = row.top.trim();
      // Linha sem número está desligada; sem nome, também.
      if (!raw || !label) continue;
      const top = Number(raw);
      if (!Number.isInteger(top) || top < 1) {
        setFeedback({ type: "error", message: "As quantidades precisam ser números inteiros a partir de 1." });
        return;
      }
      if (top <= previous) {
        setFeedback({ type: "error", message: "As quantidades precisam ser crescentes (ex.: 5, 10, 20)." });
        return;
      }
      previous = top;
      buckets.push({ label, top });
    }

    const restLabel = rows[ROWS - 1].label.trim();
    if (restLabel) buckets.push({ label: restLabel, top: null });

    if (buckets.length === 0) {
      setFeedback({ type: "error", message: "Defina ao menos um filtro." });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      await save(buckets);
      setFeedback({ type: "success", message: "Filtros salvos." });
    } catch {
      setFeedback({ type: "error", message: "Erro ao salvar os filtros." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>YouTube — filtros de tag</h2>
      <p className={styles.cardText}>
        As tags são ranqueadas por quantas vezes aparecem, e cada filtro pega a faixa seguinte do
        ranking: com 5, 10 e 20, o primeiro fica com as 5 tags mais usadas, o segundo com a 6ª à 10ª e o
        terceiro com a 11ª à 20ª. O último recebe todo o resto. Filtro cuja faixa ficou vazia não
        aparece na biblioteca. Deixe a quantidade em branco para desligar aquele filtro.
      </p>

      <div className={styles.bucketRows}>
        {rows.map((row, i) => {
          const isRest = i === ROWS - 1;
          return (
            <div key={i} className={styles.bucketRow}>
              <input
                className={styles.bucketLabel}
                type="text"
                value={row.label}
                maxLength={30}
                placeholder={isRest ? "RESTANTE" : `Nome do filtro ${i + 1}`}
                onChange={(e) => setRow(i, { label: e.target.value })}
              />
              {isRest ? (
                <span className={styles.bucketRest}>o resto</span>
              ) : (
                <input
                  className={styles.bucketTop}
                  type="number"
                  min={1}
                  value={row.top}
                  placeholder="—"
                  onChange={(e) => setRow(i, { top: e.target.value })}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={handleSave} disabled={busy}>
          Salvar filtros
        </button>
        <button
          type="button"
          className={styles.buttonSecondary}
          onClick={() => {
            setRows(toRows(DEFAULT_TAG_BUCKETS));
            setFeedback(null);
          }}
          disabled={busy}
        >
          Restaurar padrão
        </button>
      </div>

      {feedback && (
        <div className={feedback.type === "success" ? styles.success : styles.error}>{feedback.message}</div>
      )}
    </section>
  );
}
