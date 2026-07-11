// Kho vector cục bộ (LanceDB, ADR lancedb-integration). CHỈ ở main (Constitution III).
// Interface VectorStore để pipeline phụ thuộc trừu tượng → unit-test dùng mock, không cần LanceDB thật.
// File này (adapter thư viện native) loại khỏi ngưỡng coverage.

export interface VectorRecord {
  id: string; // = chunk.id
  notebookId: string;
  sourceId: string;
  vector: number[];
  dim: number;
}

export interface VectorHit {
  id: string;
  sourceId: string;
}

export interface VectorStore {
  add(records: VectorRecord[]): Promise<void>;
  deleteBySource(sourceId: string): Promise<void>;
  deleteByNotebook(notebookId: string): Promise<void>;
  countBySource(sourceId: string): Promise<number>;
  close(): Promise<void>;
}

const TABLE = "chunks";

function toRow(r: VectorRecord) {
  return {
    id: r.id,
    notebook_id: r.notebookId,
    source_id: r.sourceId,
    vector: r.vector,
    dim: r.dim,
  };
}

// Kiểu tối thiểu để không phụ thuộc chặt typings của LanceDB.
interface LanceTable {
  add(data: unknown[]): Promise<unknown>;
  delete(predicate: string): Promise<unknown>;
  countRows(filter?: string): Promise<number>;
}
interface LanceConn {
  tableNames(): Promise<string[]>;
  openTable(name: string): Promise<LanceTable>;
  createTable(name: string, data: unknown[]): Promise<LanceTable>;
}

/** Escape nháy đơn cho predicate SQL của LanceDB. */
function q(v: string): string {
  return v.replace(/'/g, "''");
}

export async function createLanceVectorStore(
  dir: string,
): Promise<VectorStore> {
  const lancedb = await import("@lancedb/lancedb");
  const conn = (await lancedb.connect(dir)) as unknown as LanceConn;
  let table: LanceTable | null = null;

  const getTable = async (): Promise<LanceTable | null> => {
    if (table) return table;
    const names = await conn.tableNames();
    if (names.includes(TABLE)) {
      table = await conn.openTable(TABLE);
    }
    return table;
  };

  return {
    async add(records) {
      if (records.length === 0) return;
      const rows = records.map(toRow);
      const t = await getTable();
      if (t) {
        await t.add(rows);
      } else {
        table = await conn.createTable(TABLE, rows);
      }
    },
    async deleteBySource(sourceId) {
      const t = await getTable();
      if (t) await t.delete(`source_id = '${q(sourceId)}'`);
    },
    async deleteByNotebook(notebookId) {
      const t = await getTable();
      if (t) await t.delete(`notebook_id = '${q(notebookId)}'`);
    },
    async countBySource(sourceId) {
      const t = await getTable();
      if (!t) return 0;
      return t.countRows(`source_id = '${q(sourceId)}'`);
    },
    async close() {
      table = null;
    },
  };
}
