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
