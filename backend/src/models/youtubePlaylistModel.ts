import type { Pool, PoolClient } from "pg";
import { pool } from "../database/connection.js";
import type { YoutubeKind } from "../types/youtubeLibrary.js";
import type { YoutubePlaylist, YoutubePlaylistBackup } from "../types/youtubePlaylist.js";

type Queryable = Pool | PoolClient;

interface PlaylistRow {
  id: string;
  name: string;
  kind: YoutubeKind;
  item_ids: string[];
  created_at: Date;
  updated_at: Date;
}

// `::text` no agregado: o driver devolve text[] como array JS em qualquer
// versão, sem depender do parser de uuid[].
const SELECT_PLAYLIST = `
  SELECT p.id, p.name, p.kind, p.created_at, p.updated_at,
         COALESCE(
           array_agg(i.entry_id::text ORDER BY i.position, i.added_at) FILTER (WHERE i.entry_id IS NOT NULL),
           '{}'
         ) AS item_ids
    FROM youtube_playlist p
    LEFT JOIN youtube_playlist_item i ON i.playlist_id = p.id
`;

function mapRow(row: PlaylistRow): YoutubePlaylist {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    itemIds: row.item_ids,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findAll(): Promise<YoutubePlaylist[]> {
  const result = await pool.query<PlaylistRow>(`${SELECT_PLAYLIST} GROUP BY p.id ORDER BY LOWER(p.name), p.id`);
  return result.rows.map(mapRow);
}

export async function findById(id: string, db: Queryable = pool): Promise<YoutubePlaylist | null> {
  const result = await db.query<PlaylistRow>(`${SELECT_PLAYLIST} WHERE p.id = $1 GROUP BY p.id`, [id]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

// O nome é único dentro da aba, sem diferenciar maiúsculas (é o índice único).
export async function findByName(kind: YoutubeKind, name: string): Promise<YoutubePlaylist | null> {
  const result = await pool.query<PlaylistRow>(
    `${SELECT_PLAYLIST} WHERE p.kind = $1 AND LOWER(p.name) = LOWER($2) GROUP BY p.id`,
    [kind, name]
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

// Entra no fim, na ordem recebida. O JOIN descarta id que não existe (mais) na
// biblioteca em vez de estourar a FK, e quem já está na playlist fica onde está.
async function appendItems(db: Queryable, playlistId: string, entryIds: string[]): Promise<void> {
  if (entryIds.length === 0) return;
  await db.query(
    `INSERT INTO youtube_playlist_item (playlist_id, entry_id, position)
     SELECT $1, e.id,
            COALESCE((SELECT MAX(position) FROM youtube_playlist_item WHERE playlist_id = $1), 0) + t.ord
       FROM unnest($2::uuid[]) WITH ORDINALITY AS t(entry_id, ord)
       JOIN youtube_library e ON e.id = t.entry_id
     ON CONFLICT (playlist_id, entry_id) DO NOTHING`,
    [playlistId, entryIds]
  );
}

export async function create(name: string, kind: YoutubeKind, entryIds: string[]): Promise<YoutubePlaylist> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO youtube_playlist (name, kind) VALUES ($1, $2) RETURNING id`,
      [name, kind]
    );
    const id = inserted.rows[0].id;
    await appendItems(client, id, entryIds);
    const playlist = await findById(id, client);
    await client.query("COMMIT");
    return playlist!;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function rename(id: string, name: string): Promise<YoutubePlaylist | null> {
  const result = await pool.query(`UPDATE youtube_playlist SET name = $2, updated_at = NOW() WHERE id = $1`, [
    id,
    name,
  ]);
  if ((result.rowCount ?? 0) === 0) return null;
  return findById(id);
}

// Os vínculos caem junto (ON DELETE CASCADE); os vídeos ficam na biblioteca.
export async function remove(id: string): Promise<boolean> {
  const result = await pool.query(`DELETE FROM youtube_playlist WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function addItems(id: string, entryIds: string[]): Promise<YoutubePlaylist | null> {
  if (!(await findById(id))) return null;
  await appendItems(pool, id, entryIds);
  return findById(id);
}

export async function removeItems(id: string, entryIds: string[]): Promise<YoutubePlaylist | null> {
  if (!(await findById(id))) return null;
  await pool.query(`DELETE FROM youtube_playlist_item WHERE playlist_id = $1 AND entry_id = ANY($2::uuid[])`, [
    id,
    entryIds,
  ]);
  return findById(id);
}

export async function findAllForBackup(): Promise<YoutubePlaylistBackup[]> {
  const result = await pool.query<{ name: string; kind: YoutubeKind; video_ids: string[] }>(
    `SELECT p.name, p.kind,
            COALESCE(
              array_agg(e.video_id ORDER BY i.position, i.added_at) FILTER (WHERE e.video_id IS NOT NULL),
              '{}'
            ) AS video_ids
       FROM youtube_playlist p
       LEFT JOIN youtube_playlist_item i ON i.playlist_id = p.id
       LEFT JOIN youtube_library e ON e.id = i.entry_id
      GROUP BY p.id
      ORDER BY p.kind, LOWER(p.name)`
  );
  return result.rows.map((row) => ({ name: row.name, kind: row.kind, videoIds: row.video_ids }));
}

// Import de backup: funde por (aba, nome) e só acrescenta — como o resto do
// import, não apaga o que já está no banco. Roda na transação do import, depois
// das linhas do YouTube, para os `video_id` já existirem.
export async function importPlaylist(client: PoolClient, playlist: YoutubePlaylistBackup): Promise<void> {
  const upserted = await client.query<{ id: string }>(
    `INSERT INTO youtube_playlist (name, kind) VALUES ($1, $2)
     ON CONFLICT (kind, LOWER(name)) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [playlist.name, playlist.kind]
  );
  const id = upserted.rows[0].id;
  if (playlist.videoIds.length === 0) return;
  await client.query(
    `INSERT INTO youtube_playlist_item (playlist_id, entry_id, position)
     SELECT $1, e.id,
            COALESCE((SELECT MAX(position) FROM youtube_playlist_item WHERE playlist_id = $1), 0) + t.ord
       FROM unnest($2::text[]) WITH ORDINALITY AS t(video_id, ord)
       JOIN youtube_library e ON e.video_id = t.video_id
     ON CONFLICT (playlist_id, entry_id) DO NOTHING`,
    [id, playlist.videoIds]
  );
}
