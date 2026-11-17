import { useState } from "react";
import styles from "./YoutubePlaylistActions.module.css";

interface YoutubePlaylistActionsProps {
  name: string;
  // Nomes das outras playlists da aba, para recusar o repetido antes do servidor.
  takenNames: string[];
  onRename: (name: string) => void;
  onDelete: () => void;
}

type Mode = "idle" | "renaming" | "deleting";

// Renomear e excluir moram dentro da playlist aberta, e não num menu flutuante:
// a lista tem rolagem própria e cortaria um popover ancorado na linha.
export function YoutubePlaylistActions({ name, takenNames, onRename, onDelete }: YoutubePlaylistActionsProps) {
  const [mode, setMode] = useState<Mode>("idle");
  const [draft, setDraft] = useState(name);

  const trimmed = draft.trim();
  const duplicate = takenNames.some((taken) => taken.toLowerCase() === trimmed.toLowerCase());

  if (mode === "renaming") {
    return (
      <form
        className={styles.strip}
        onSubmit={(event) => {
          event.preventDefault();
          if (!trimmed || duplicate) return;
          if (trimmed !== name) onRename(trimmed);
          setMode("idle");
        }}
      >
        <input
          className={styles.input}
          type="text"
          value={draft}
          maxLength={120}
          autoFocus
          aria-label="Nome da playlist"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className={styles.confirm} disabled={!trimmed || duplicate}>
          Salvar
        </button>
        <button type="button" className={styles.link} onClick={() => setMode("idle")}>
          Cancelar
        </button>
        {trimmed && duplicate && <span className={styles.error}>Já existe uma playlist com esse nome.</span>}
      </form>
    );
  }

  if (mode === "deleting") {
    return (
      <div className={styles.strip}>
        <span className={styles.question}>Excluir a playlist? Os itens continuam na biblioteca.</span>
        <button type="button" className={styles.danger} onClick={onDelete}>
          Excluir
        </button>
        <button type="button" className={styles.link} onClick={() => setMode("idle")}>
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className={styles.strip}>
      <button
        type="button"
        className={styles.link}
        onClick={() => {
          setDraft(name);
          setMode("renaming");
        }}
      >
        Renomear
      </button>
      <button type="button" className={styles.link} onClick={() => setMode("deleting")}>
        Excluir playlist
      </button>
    </div>
  );
}
