import { pool } from "../database/connection.js";

// Configuração genérica de UI: uma linha por chave, valor em JSONB. Evita uma
// tabela (e um endpoint) por preferência.
export async function getSetting(key: string): Promise<unknown | undefined> {
  const result = await pool.query<{ value: unknown }>(
    `SELECT value FROM app_setting WHERE key = $1`,
    [key]
  );
  return result.rows[0]?.value;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await pool.query(
    `INSERT INTO app_setting (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  );
}
