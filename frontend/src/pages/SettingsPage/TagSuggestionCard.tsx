import { useState } from "react";
import { useAppSetting } from "../../hooks/useAppSetting";
import { DEFAULT_TAG_SUGGESTIONS, TAG_SUGGESTIONS_KEY } from "../../types/youtubeLibrary";
import styles from "./SettingsPage.module.css";

const MIN = 1;
const MAX = 30;

export function TagSuggestionCard() {
  const { value, loaded, save } = useAppSetting<number>(TAG_SUGGESTIONS_KEY, DEFAULT_TAG_SUGGESTIONS);
  const [draft, setDraft] = useState(String(value));
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Sincroniza quando a config chega do banco (ajuste de estado em render, mesmo
  // padrão do `prevAnimationKey` do FranchiseGrid).
  const [synced, setSynced] = useState(value);
  if (loaded && synced !== value) {
    setSynced(value);
    setDraft(String(value));
  }

  const handleSave = async () => {
    const limit = Number(draft.trim());
    if (!Number.isInteger(limit) || limit < MIN || limit > MAX) {
      setFeedback({ type: "error", message: `Informe um número inteiro entre ${MIN} e ${MAX}.` });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await save(limit);
      setFeedback({ type: "success", message: "Quantidade salva." });
    } catch {
      setFeedback({ type: "error", message: "Erro ao salvar." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>YouTube — sugestões de tag</h2>
      <p className={styles.cardText}>
        Quantas tags a faixa acima da busca sugere de uma vez. Elas são as que mais aparecem junto com as
        tags que você já filtrou — clicar numa delas afunila, e a faixa se recalcula.
      </p>

      <div className={styles.bucketRow}>
        <input
          className={styles.bucketTop}
          type="number"
          min={MIN}
          max={MAX}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="button" className={styles.button} onClick={handleSave} disabled={busy}>
          Salvar
        </button>
        <button
          type="button"
          className={styles.buttonSecondary}
          onClick={() => {
            setDraft(String(DEFAULT_TAG_SUGGESTIONS));
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
