import { describe, expect, it } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import { runMigrations } from "../../src/main/db/migrations";
import { createSourceRepo } from "../../src/main/services/ingestion/source-repo";
import { createIngestionPipeline } from "../../src/main/services/ingestion/pipeline";
import type { VectorStore } from "../../src/main/services/ingestion/vector-store";
import type { ParseResult } from "../../src/main/services/ingestion/parsers";

// 112 (FR-008, research R7): pipeline truyền blocks (vùng bảng) từ parser PDF sang chunker; nếu bước làm sạch đổi
// văn bản trang (offset blocks không còn đúng) ⇒ bỏ blocks của trang đó (chunk vẫn hợp lệ).

const vectors: VectorStore = {
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

const before = "Intro ".repeat(50).trim(); // ~300 ký tự, không xuống dòng
const table = [
  "| Item | Qty | Price |",
  "|---|---|---|",
  ...Array.from({ length: 30 }, (_, i) => `| Row ${i} item | ${i} | ${i}.00 |`),
].join("\n"); // ~700 ký tự: bảng "ngắn" (< 1000) nhưng vắt qua nửa sau cửa sổ đầu
const after = "Outro ".repeat(100).trim();

async function run(parsed: ParseResult, kind: "pdf" | "txt" = "pdf") {
  const db = openDatabase(":memory:");
  runMigrations(db);
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
  ).run("nb1", "N", "#4F46E5", 1, 1);
  let n = 0;
  const repo = createSourceRepo(db, { now: () => 1, uuid: () => `id-${++n}` });
  const pipeline = createIngestionPipeline({
    sourceRepo: repo,
    vectorStore: vectors,
    getProvider: () => ({ embed: async () => ({ vector: [1] }) }),
    isRuntimeReady: async () => true,
    readFile: async () => new Uint8Array([1]),
    parseFile: async () => parsed,
    emit: () => {},
  });
  const { source } = await pipeline.add({
    notebookId: "nb1",
    kind,
    filePath: kind === "pdf" ? "/doc.pdf" : "/doc.txt",
  });
  await pipeline.whenIdle();
  const chunks = repo.listChunks(source.id);
  return Object.assign(chunks, { source: repo.getById(source.id)! });
}

describe("pipeline + blocks (112)", () => {
  it("văn bản đã sạch ⇒ blocks được dùng: chunk đầu dừng TRƯỚC bảng", async () => {
    const text = `${before}\n\n${table}\n\n${after}`;
    const start = before.length + 2;
    const chunks = await run({
      pageCount: 1,
      pages: [
        { page: 1, text, blocks: [{ start, end: start + table.length }] },
      ],
    });
    expect(chunks[0].locator.charEnd).toBe(start);
    expect(chunks.some((c) => c.text.includes(table))).toBe(true);
  });

  it("làm sạch đổi văn bản (khoảng trắng thừa) ⇒ bỏ blocks, chunk vẫn khớp văn bản", async () => {
    const text = `${before}  x\n\n${table}\n\n${after}`; // "  " bị cleanText gộp ⇒ offset lệch
    const start = before.length + 5;
    const chunks = await run({
      pageCount: 1,
      pages: [
        { page: 1, text, blocks: [{ start, end: start + table.length }] },
      ],
    });
    // không dùng blocks ⇒ chunk đầu cắt ở một "\n" bên trong bảng (hành vi cũ)
    expect(chunks[0].locator.charEnd).toBeGreaterThan(start);
    expect(chunks[0].text.endsWith("\n")).toBe(true);
  });
});

describe("pipeline ghi extractionVersion (112, FR-010)", () => {
  it("PDF nạp thành công ⇒ extractionVersion = PDF_EXTRACTION_VERSION (3 — 147)", async () => {
    const { PDF_EXTRACTION_VERSION } = await import("@shared/ipc/types");
    const r = await run({ pageCount: 1, pages: [{ page: 1, text: "Hello" }] });
    expect(PDF_EXTRACTION_VERSION).toBe(3);
    expect(r.source.status).toBe("ready");
    expect(r.source.extractionVersion).toBe(PDF_EXTRACTION_VERSION);
  });

  it("loại khác giữ 1", async () => {
    const r = await run(
      { pageCount: null, pages: [{ page: null, text: "Hello" }] },
      "txt",
    );
    expect(r.source.extractionVersion).toBe(1);
  });
});
