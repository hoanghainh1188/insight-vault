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

/** Kết quả tìm kiếm vector (013-rag-qa). `score` = khoảng cách (nhỏ = liên quan hơn). */
export interface VectorSearchHit {
  id: string; // = chunk.id
  sourceId: string;
  score: number;
}

export interface VectorStore {
  add(records: VectorRecord[]): Promise<void>;
  deleteBySource(sourceId: string): Promise<void>;
  deleteByNotebook(notebookId: string): Promise<void>;
  countBySource(sourceId: string): Promise<number>;
  /** Tìm topK chunk gần nhất trong phạm vi notebook (013). Bảng chưa tồn tại → []. */
  search(
    queryVector: number[],
    notebookId: string,
    topK: number,
  ): Promise<VectorSearchHit[]>;
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
interface LanceQuery {
  where(predicate: string): LanceQuery;
  limit(n: number): LanceQuery;
  distanceType(t: string): LanceQuery;
  toArray(): Promise<Record<string, unknown>[]>;
}
interface LanceTable {
  add(data: unknown[]): Promise<unknown>;
  delete(predicate: string): Promise<unknown>;
  countRows(filter?: string): Promise<number>;
  search(vector: number[]): LanceQuery;
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
    async search(queryVector, notebookId, topK) {
      const t = await getTable();
      if (!t) return []; // chưa nạp nguồn nào
      // Cosine distance (bị chặn [0,2], chuẩn cho text embedding) thay vì L2 mặc định — vector
      // embedding (vd nomic-embed-text) KHÔNG chuẩn hoá nên L2 không có ngưỡng ổn định (issue #15).
      const rows = await t
        .search(queryVector)
        .distanceType("cosine")
        .where(`notebook_id = '${q(notebookId)}'`)
        .limit(topK)
        .toArray();
      return rows.map((r) => ({
        id: String(r["id"]),
        sourceId: String(r["source_id"]),
        score: Number(r["_distance"]),
      }));
    },
    async close() {
      table = null;
    },
  };
}
