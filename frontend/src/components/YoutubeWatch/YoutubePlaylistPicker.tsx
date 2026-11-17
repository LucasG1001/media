import { useState, type ReactNode } from "react";
import { useDismiss } from "../../hooks/useDismiss";
import type { YoutubePlaylist } from "../../types/youtubeLibrary";
import styles from "./YoutubePlaylistPicker.module.css";

interface YoutubePlaylistPickerProps {
  // O gatilho é desenhado pelo dono (botão de ação abaixo do player, botão da
  // barra de seleção): o menu só recebe a classe e o rótulo.
  label: ReactNode;
  buttonClassName: string;
  // As playlists da aba dos itens, já em ordem.
  playlists: YoutubePlaylist[];
  // Quem o menu põe nas playlists: o item atual ou a seleção inteira.
  entryIds: string[];
  // Item único: escolher uma playlist em que ele já está o tira dela, e o menu
  // fica aberto (é uma lista de marcações). Em lote o menu só adiciona e fecha.
  single?: boolean;
  onAdd: (playlistId: string) => void;
  onRemove?: (playlistId: string) => void;
  onCreate: (name: string) => void;
  // Para onde o menu abre a partir do gatilho.
  placement?: "down" | "up";
  disabled?: boolean;
  disabledHint?: string;
}

function membership(playlist: YoutubePlaylist, entryIds: string[]): number {
  return entryIds.filter((id) => playlist.itemIds.includes(id)).length;
}

export function YoutubePlaylistPicker({
  label,
  buttonClassName,
  playlists,
  entryIds,
  single = false,
  onAdd,
  onRemove,
  onCreate,
  placement = "down",
  disabled = false,
  disabledHint,
}: YoutubePlaylistPickerProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const close = () => {
    setOpen(false);
    setName("");
  };
  useDismiss(open, close);

  const trimmed = name.trim();
  const duplicate = playlists.some((playlist) => playlist.name.toLowerCase() === trimmed.toLowerCase());

  const pick = (playlist: YoutubePlaylist, complete: boolean) => {
    if (complete) onRemove?.(playlist.id);
    else onAdd(playlist.id);
    if (!single) close();
  };

  const submit = () => {
    if (!trimmed || duplicate) return;
    onCreate(trimmed);
    if (single) setName("");
    else close();
  };

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        title={disabled ? disabledHint : undefined}
      >
        {label}
      </button>
      {open && (
        <>
          <div className={styles.overlay} data-testid="playlist-overlay" onClick={close} />
          <div
            className={`${styles.panel} ${placement === "up" ? styles.panelUp : ""}`}
            role="dialog"
            aria-label="Playlists"
          >
            {playlists.length === 0 ? (
              <div className={styles.empty}>Nenhuma playlist ainda.</div>
            ) : (
              <ul className={styles.list}>
                {playlists.map((playlist) => {
                  const inside = membership(playlist, entryIds);
                  const complete = entryIds.length > 0 && inside === entryIds.length;
                  // Em lote não há o que fazer numa playlist que já tem todos.
                  const inert = complete && !single;
                  return (
                    <li key={playlist.id}>
                      <button
                        type="button"
                        className={`${styles.item} ${complete ? styles.itemOn : ""}`}
                        aria-pressed={complete}
                        disabled={inert}
                        onClick={() => pick(playlist, complete)}
                      >
                        <span className={styles.box} aria-hidden="true">
                          {complete ? "✓" : ""}
                        </span>
                        <span className={styles.itemName} title={playlist.name}>
                          {playlist.name}
                        </span>
                        {!single && inside > 0 && (
                          <span className={styles.itemHint}>
                            {complete ? "já estão" : `${inside} de ${entryIds.length} já ${inside === 1 ? "está" : "estão"}`}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <form
              className={styles.create}
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <input
                className={styles.input}
                type="text"
                value={name}
                maxLength={120}
                placeholder="Nova playlist…"
                aria-label="Nome da nova playlist"
                onChange={(event) => setName(event.target.value)}
              />
              <button type="submit" className={styles.createButton} disabled={!trimmed || duplicate}>
                Criar
              </button>
            </form>
            {trimmed && duplicate && <div className={styles.error}>Já existe uma playlist com esse nome.</div>}
          </div>
        </>
      )}
    </div>
  );
}
