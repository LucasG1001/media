import type { YoutubePlaylist } from "../../types/youtubeLibrary";
import { YoutubePlaylistPicker } from "./YoutubePlaylistPicker";
import styles from "./YoutubeSelectionBar.module.css";

interface YoutubeSelectionBarProps {
  // Ids dos itens marcados.
  entryIds: string[];
  // Todos os itens da lista de baixo já estão marcados.
  allSelected: boolean;
  onToggleAll: () => void;
  onCancel: () => void;
  // As playlists da aba ativa — a seleção é sempre de uma aba só.
  playlists: YoutubePlaylist[];
  onAdd: (playlistId: string) => void;
  onCreate: (name: string) => void;
  online: boolean;
}

// A barra do modo de seleção. Fica visível o modo inteiro, mesmo sem nada
// marcado: é ela que diz que clicar numa linha agora marca em vez de tocar.
// Não reaproveita a `SelectionBar` das grades porque aquela só aplica status.
export function YoutubeSelectionBar({
  entryIds,
  allSelected,
  onToggleAll,
  onCancel,
  playlists,
  onAdd,
  onCreate,
  online,
}: YoutubeSelectionBarProps) {
  const count = entryIds.length;
  const hint = count === 0 ? "Marque ao menos um item." : "Sem conexão — não dá para alterar agora.";

  return (
    <div className={styles.bar} role="toolbar" aria-label="Ações de seleção">
      <button type="button" className={styles.close} onClick={onCancel} aria-label="Cancelar seleção" title="Cancelar seleção">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      <span className={styles.count}>
        {count === 0 ? "Marque os itens" : `${count} selecionado${count > 1 ? "s" : ""}`}
      </span>
      {/* Rótulo curto: a barra divide a largura do painel com mais dois botões. */}
      <button
        type="button"
        className={styles.button}
        onClick={onToggleAll}
        aria-label={allSelected ? "Desmarcar todos" : "Selecionar todos"}
        title={allSelected ? "Desmarcar todos" : "Selecionar todos"}
      >
        {allSelected ? "Nenhum" : "Todos"}
      </button>
      <YoutubePlaylistPicker
        label="Adicionar à playlist"
        buttonClassName={styles.primary}
        placement="up"
        playlists={playlists}
        entryIds={entryIds}
        onAdd={onAdd}
        onCreate={onCreate}
        disabled={count === 0 || !online}
        disabledHint={hint}
      />
    </div>
  );
}
