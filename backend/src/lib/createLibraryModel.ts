import { pool } from "../database/connection.js";
import { completedOnInsertSql, completionUpdateSql, lastAccessUpdateSql } from "./completionSql.js";

export interface FieldSpec {
  column: string;
  field: string;
  default?: unknown;
  numeric?: boolean;
  readonly?: boolean;
}

export interface LibraryModelConfig {
  table: string;
  externalId: { column: string; field: string };
  fields: FieldSpec[];
  statusField: string;
  // `rewatchStatus`: revisita (reassistindo/rejogando/relendo), que preserva a data
  // de conclusão e cuja volta ao concluído grava o último acesso.
  completion: { column: string; field: string; whenStatus: string; rewatchStatus?: string };
  // Última vez consumido. Distinto do `completion`: é gravado ao entrar no status
  // concluído (inclusive vindo da revisita) e nunca é limpo ao sair dele.
  lastAccess?: { column: string; field: string };
  collectionColumn?: string;
}

export interface LibraryModel<TEntry, TCreate, TUpdate> {
  findAll(): Promise<TEntry[]>;
  findById(id: string): Promise<TEntry | null>;
  findByExternalId(externalId: number | string): Promise<TEntry | null>;
  create(entry: TCreate): Promise<TEntry>;
  update(id: string, data: TUpdate): Promise<TEntry | null>;
  updateManyStatus(ids: string[], status: string): Promise<TEntry[]>;
  remove(id: string): Promise<boolean>;
  removeMany(ids: string[]): Promise<number>;
  setCover?(id: string): Promise<TEntry | null>;
}

type Row = Record<string, unknown>;

export function createLibraryModel<TEntry, TCreate, TUpdate>(
  config: LibraryModelConfig
): LibraryModel<TEntry, TCreate, TUpdate> {
  const { table, externalId, fields, statusField, completion, lastAccess, collectionColumn } = config;

  const toEntry = (row: Row): TEntry => {
    const entry: Row = { id: row.id };
    entry[externalId.field] = row[externalId.column];
    for (const f of fields) {
      const value = row[f.column];
      // Coluna NUMERIC anulável (series_position) precisa do guard: parseFloat(null) é NaN.
      entry[f.field] = f.numeric && value != null ? parseFloat(value as string) : value;
    }
    entry[completion.field] = row[completion.column];
    if (lastAccess) entry[lastAccess.field] = row[lastAccess.column];
    entry.createdAt = row.created_at;
    entry.updatedAt = row.updated_at;
    return entry as TEntry;
  };

  const findAll = async (): Promise<TEntry[]> => {
    const result = await pool.query<Row>(`SELECT * FROM ${table} ORDER BY updated_at DESC`);
    return result.rows.map(toEntry);
  };

  const findById = async (id: string): Promise<TEntry | null> => {
    const result = await pool.query<Row>(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    return result.rows[0] ? toEntry(result.rows[0]) : null;
  };

  const findByExternalId = async (value: number | string): Promise<TEntry | null> => {
    const result = await pool.query<Row>(`SELECT * FROM ${table} WHERE ${externalId.column} = $1`, [value]);
    return result.rows[0] ? toEntry(result.rows[0]) : null;
  };

  const create = async (entry: TCreate): Promise<TEntry> => {
    const data = entry as Row;
    const insertable = fields.filter((f) => !f.readonly);
    const insertCols = [externalId.column, ...insertable.map((f) => f.column)];
    const values: unknown[] = [
      data[externalId.field],
      ...insertable.map((f) => {
        const value = data[f.field];
        return value === undefined ? f.default ?? null : value;
      }),
    ];
    const placeholders = values.map((_, i) => `$${i + 1}`);
    const statusParam = insertable.findIndex((f) => f.field === statusField) + 2;
    insertCols.push(completion.column);
    placeholders.push(completedOnInsertSql(`$${statusParam}`, completion.whenStatus));
    // Entrar na biblioteca já concluído conta como acesso (adicionar do catálogo
    // direto como assistido/zerado).
    if (lastAccess) {
      insertCols.push(lastAccess.column);
      placeholders.push(completedOnInsertSql(`$${statusParam}`, completion.whenStatus));
    }
    const result = await pool.query<Row>(
      `INSERT INTO ${table} (${insertCols.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
      values
    );
    return toEntry(result.rows[0]);
  };

  const statusColumn = fields.find((f) => f.field === statusField)?.column ?? statusField;

  const update = async (id: string, data: TUpdate): Promise<TEntry | null> => {
    const patch = data as Row;
    const sets: string[] = [];
    const values: unknown[] = [];
    let index = 1;
    let statusParam: number | null = null;

    for (const f of fields) {
      if (f.readonly) continue;
      if (patch[f.field] === undefined) continue;
      if (f.field === statusField) {
        statusParam = index++;
        sets.push(`${f.column} = $${statusParam}`);
        values.push(patch[f.field]);
        sets.push(
          `${completion.column} = ${completionUpdateSql(completion.column, `$${statusParam}`, f.column, completion)}`
        );
      } else {
        sets.push(`${f.column} = $${index++}`);
        values.push(patch[f.field]);
      }
    }

    if (lastAccess && statusParam != null) {
      sets.push(
        `${lastAccess.column} = ${lastAccessUpdateSql(lastAccess.column, `$${statusParam}`, statusColumn, completion)}`
      );
    }

    if (sets.length === 0) return findById(id);

    sets.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query<Row>(
      `UPDATE ${table} SET ${sets.join(", ")} WHERE id = $${index} RETURNING *`,
      values
    );
    return result.rows[0] ? toEntry(result.rows[0]) : null;
  };

  const lastAccessBulkSet = lastAccess
    ? `${lastAccess.column} = ${lastAccessUpdateSql(lastAccess.column, "$2", statusColumn, completion)},`
    : "";

  const updateManyStatus = async (ids: string[], status: string): Promise<TEntry[]> => {
    if (ids.length === 0) return [];
    const result = await pool.query<Row>(
      `UPDATE ${table}
          SET ${statusColumn} = $2,
              ${completion.column} = ${completionUpdateSql(completion.column, "$2", statusColumn, completion)},
              ${lastAccessBulkSet}
              updated_at = NOW()
        WHERE id = ANY($1::uuid[])
       RETURNING *`,
      [ids, status]
    );
    return result.rows.map(toEntry);
  };

  const remove = async (id: string): Promise<boolean> => {
    const result = await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  };

  const removeMany = async (ids: string[]): Promise<number> => {
    if (ids.length === 0) return 0;
    const result = await pool.query(`DELETE FROM ${table} WHERE id = ANY($1::uuid[])`, [ids]);
    return result.rowCount ?? 0;
  };

  const setCover = async (id: string): Promise<TEntry | null> => {
    const col = collectionColumn as string;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE ${table} SET is_cover = FALSE
         WHERE ${col} = (SELECT ${col} FROM ${table} WHERE id = $1) AND ${col} IS NOT NULL`,
        [id]
      );
      const result = await client.query<Row>(
        `UPDATE ${table} SET is_cover = TRUE WHERE id = $1 RETURNING *`,
        [id]
      );
      await client.query("COMMIT");
      return result.rows[0] ? toEntry(result.rows[0]) : null;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };

  const model: LibraryModel<TEntry, TCreate, TUpdate> = {
    findAll,
    findById,
    findByExternalId,
    create,
    update,
    updateManyStatus,
    remove,
    removeMany,
  };
  if (collectionColumn) model.setCover = setCover;
  return model;
}
