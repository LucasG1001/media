import type { YoutubeKind } from "./youtubeLibrary.js";

// `itemIds` são ids de `youtube_library`, na ordem da playlist. A lista guarda
// todo vínculo, inclusive o de item removido ou movido para a outra aba — quem
// decide o que aparece é a tela.
export interface YoutubePlaylist {
  id: string;
  name: string;
  kind: YoutubeKind;
  itemIds: string[];
  createdAt: string;
  updatedAt: string;
}

// Formato do backup: os itens vão por `video_id`, porque o uuid da linha muda
// quando a biblioteca é importada em outro banco.
export interface YoutubePlaylistBackup {
  name: string;
  kind: YoutubeKind;
  videoIds: string[];
}
