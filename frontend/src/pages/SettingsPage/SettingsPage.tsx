import { useRef, useState } from "react";
import { api } from "../../services/api";
import { useLibrary } from "../../hooks/useLibrary";
import { useMovieLibrary } from "../../hooks/useMovieLibrary";
import { useSeriesLibrary } from "../../hooks/useSeriesLibrary";
import { useBookLibrary } from "../../hooks/useBookLibrary";
import { useGameLibrary } from "../../hooks/useGameLibrary";
import styles from "./SettingsPage.module.css";

type Feedback = { type: "success" | "error"; message: string } | null;

export function SettingsPage() {
  const { load: loadAnime } = useLibrary();
  const { load: loadMovies } = useMovieLibrary();
  const { load: loadSeries } = useSeriesLibrary();
  const { load: loadBooks } = useBookLibrary();
  const { load: loadGames } = useGameLibrary();

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.get("/api/backup/export");
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `media-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setFeedback({ type: "success", message: "Backup exportado." });
    } catch {
      setFeedback({ type: "error", message: "Erro ao exportar o backup." });
    } finally {
      setBusy(false);
    }
  };

  const handleExportDump = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.get("/api/backup/export/dump", { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `media-tracker-backup-${new Date().toISOString().slice(0, 10)}.dump`;
      link.click();
      URL.revokeObjectURL(url);
      setFeedback({ type: "success", message: "Dump exportado." });
    } catch {
      setFeedback({ type: "error", message: "Erro ao exportar o dump." });
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (file: File) => {
    setBusy(true);
    setFeedback(null);
    try {
      const data = JSON.parse(await file.text());
      const res = await api.post("/api/backup/import", data);
      const imported = (res.data?.imported ?? {}) as Record<string, number>;
      const total = Object.values(imported).reduce((sum, n) => sum + n, 0);
      await Promise.all([loadAnime(), loadMovies(), loadSeries(), loadBooks(), loadGames()]);
      setFeedback({ type: "success", message: `Backup importado: ${total} itens.` });
    } catch {
      setFeedback({ type: "error", message: "Erro ao importar. Verifique o arquivo." });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Configurações</h1>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Backup</h2>
        <p className={styles.cardText}>
          Exporte toda a sua biblioteca em JSON (restaurável aqui pelo botão importar) ou gere um dump
          nativo do PostgreSQL (.dump) para recuperação completa via pg_restore. A importação de JSON
          mescla os dados (adiciona e atualiza), sem apagar o que já existe.
        </p>

        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={handleExport} disabled={busy}>
            Exportar JSON
          </button>
          <button type="button" className={styles.button} onClick={handleExportDump} disabled={busy}>
            Baixar .dump
          </button>
          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            Importar backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className={styles.fileInput}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
        </div>

        {feedback && (
          <div className={feedback.type === "success" ? styles.success : styles.error}>{feedback.message}</div>
        )}
      </section>
    </div>
  );
}
