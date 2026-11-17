import type { YoutubePlaylistBackup } from "../types/youtubePlaylist.js";

type Row = Record<string, unknown>;

function rowsOf(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

// Linhas do YouTube de um arquivo de backup, em qualquer formato que o app já
// exportou. Backup antigo trazia Música numa chave própria (`music`) e as
// coleções do YouTube à parte (`youtubeCollections`, hoje ignoradas): as músicas
// entram como `kind = 'music'` e vão **depois** dos vídeos, para vencerem o
// upsert quando o mesmo vídeo estava nos dois lados. Linha de `youtube` sem
// `kind` é de antes da fusão e era vídeo.
export function youtubeRowsFromBackup(body: Row): Row[] {
  const videos = rowsOf(body.youtube).map((row) => ({ ...row, kind: row.kind ?? "video" }));
  const legacyMusic = rowsOf(body.music).map((row) => ({ ...row, kind: "music" }));
  return [...videos, ...legacyMusic];
}

// Playlists do YouTube de um arquivo de backup (chave `youtubePlaylists`; arquivo
// de antes delas simplesmente não a tem). O arquivo é entrada de fora: playlist
// sem nome ou de tipo desconhecido é descartada, e `videoIds` fica só com texto.
export function youtubePlaylistsFromBackup(body: Row): YoutubePlaylistBackup[] {
  const playlists: YoutubePlaylistBackup[] = [];
  for (const row of rowsOf(body.youtubePlaylists)) {
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name || (row.kind !== "music" && row.kind !== "video")) continue;
    const videoIds = Array.isArray(row.videoIds)
      ? row.videoIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    playlists.push({ name, kind: row.kind, videoIds });
  }
  return playlists;
}
