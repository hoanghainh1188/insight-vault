import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import { runMigrations } from "../../src/main/db/migrations";
import { createSourceRepo } from "../../src/main/services/ingestion/source-repo";
import { createIngestionPipeline } from "../../src/main/services/ingestion/pipeline";
import { parseText } from "../../src/main/services/ingestion/parsers/text";
import { parseDocx } from "../../src/main/services/ingestion/parsers/docx";
import type { VectorStore } from "../../src/main/services/ingestion/vector-store";
import type { SourceKind } from "@shared/ipc/types";

// 112 (FR-023, SC-007): các loại nguồn KHÁC PDF phải cho văn bản + chunk y hệt trước feature. Snapshot được chụp từ
// code trên main TRƯỚC khi sửa chunker/pipeline và KHÔNG được cập nhật về sau.
// Ngoại lệ có chủ đích: 159 dời đầu chunk chồng lấn tới ranh giới câu/từ — chỉ charStart + đầu text đổi, cập nhật 1 lần.

const FIXTURES = join(__dirname, "..", "fixtures");

// Văn bản dài tất định (nhiều chunk, có đoạn/dòng/câu) để phủ cả việc chia đoạn nhiều chunk.
function longText(): string {
  const paras = Array.from({ length: 12 }, (_, p) =>
    Array.from(
      { length: 9 },
      (_, s) => `Doan ${p} cau ${s} co noi dung thu nghiem du dai de chia.`,
    ).join(p % 3 === 0 ? "\n" : " "),
  );
  return paras.join("\n\n");
}

const noopVectors: VectorStore = {
  async add() {},
  async deleteBySource() {},
  async deleteByIds() {},
  async deleteByNotebook() {},
  async countBySource() {
    return 0;
  },
  async countByNotebook() {
    return 0;
  },
  async search() {
    return [];
  },
  async getVectorsByIds() {
    return new Map();
  },
  async dropTable() {},
  // 116: bảo trì kho — mock không có bảng.
  async stats() {
    return null;
  },
  async optimize() {
    return null;
  },
  activeOperations: () => 0,
  async close() {},
};

async function ingest(file: string, kind: Exclude<SourceKind, "url">) {
  const db = openDatabase(":memory:");
  runMigrations(db);
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
  ).run("nb1", "N", "#4F46E5", 1, 1);
  let n = 0;
  const repo = createSourceRepo(db, { now: () => 1, uuid: () => `id-${++n}` });
  const pipeline = createIngestionPipeline({
    sourceRepo: repo,
    vectorStore: noopVectors,
    getProvider: () => ({ embed: async () => ({ vector: [1, 0, 0] }) }),
    isRuntimeReady: async () => true,
    readFile: async (p) => new Uint8Array(readFileSync(p)),
    parseFile: async (k, bytes) =>
      k === "docx"
        ? parseDocx(Buffer.from(bytes))
        : parseText(new TextDecoder().decode(bytes)),
    emit: () => {},
  });
  const { source } = await pipeline.add({
    notebookId: "nb1",
    kind,
    filePath: file.startsWith("/") ? file : join(FIXTURES, file),
  });
  await pipeline.whenIdle();
  const s = repo.getById(source.id)!;
  expect(s.status).toBe("ready");
  return repo.listChunks(source.id).map((c) => ({
    ordinal: c.ordinal,
    text: c.text,
    locator: c.locator,
  }));
}

describe("các loại nguồn khác PDF không đổi (snapshot từ main)", () => {
  it.each([
    ["sample.txt", "txt"],
    ["sample.md", "md"],
    ["sample.docx", "docx"],
  ] as const)("%s", async (file, kind) => {
    expect(await ingest(file, kind)).toMatchSnapshot();
  });

  it("long.txt (tự sinh, nhiều chunk)", async () => {
    const f = join(mkdtempSync(join(tmpdir(), "iv-long-")), "long.txt");
    writeFileSync(f, longText());
    const chunks = await ingest(f, "txt");
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks).toMatchSnapshot();
  });
});
