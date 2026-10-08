import { describe, expect, it } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import { runMigrations } from "../../src/main/db/migrations";
import { createSourceRepo } from "../../src/main/services/ingestion/source-repo";
import { createIngestionPipeline } from "../../src/main/services/ingestion/pipeline";
import type {
  VectorRecord,
  VectorStore,
} from "../../src/main/services/ingestion/vector-store";
import type { ParseResult } from "../../src/main/services/ingestion/parsers";
import type { SourceProgressEvent } from "@shared/ipc/types";

// 112 (FR-010, FR-015, FR-016; research R10): "Xử lý lại" nguồn PDF — dựng chunk + vector mới trong RAM rồi hoán đổi
// nguyên tử; nguồn GIỮ `ready` suốt quá trình; lỗi/huỷ ở bất kỳ bước nào ⇒ dữ liệu cũ nguyên vẹn.

type Fail = "parse" | "embed" | "add" | "replace" | "deleteOld" | null;

function harness() {
  const db = openDatabase(":memory:");
  runMigrations(db);
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
  ).run("nb1", "N", "#4F46E5", 1, 1);
  let n = 0;
  const repo = createSourceRepo(db, { now: () => 1, uuid: () => `id-${++n}` });
  const vectors = new Map<string, VectorRecord>();
  const calls: string[] = [];
  const ctl = {
    fail: null as Fail,
    text: "Old flat text of the document page one",
    vaultLocked: false,
    gate: null as Promise<void> | null,
    fileBytes: new Uint8Array([1]),
  };
  const store: VectorStore = {
    async add(recs) {
      calls.push(`add:${recs.length}`);
      for (const r of recs) vectors.set(r.id, r);
      if (ctl.fail === "add") throw new Error("lance add fail");
    },
    async deleteBySource(sid) {
      for (const [k, v] of vectors) if (v.sourceId === sid) vectors.delete(k);
    },
    async deleteByIds(ids) {
      calls.push(`deleteByIds:${ids.join(",")}`);
      if (ctl.fail === "deleteOld" && ids.some((i) => i.startsWith("id-"))) {
        throw new Error("lance delete fail");
      }
      for (const id of ids) vectors.delete(id);
    },
    async deleteByNotebook() {},
    async countBySource(sid) {
      return [...vectors.values()].filter((v) => v.sourceId === sid).length;
    },
    async countByNotebook() {
      return vectors.size;
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
  const events: SourceProgressEvent[] = [];
  let newId = 0;
  const pipeline = createIngestionPipeline({
    sourceRepo: repo,
    vectorStore: store,
    getProvider: () => ({ embed: async () => ({ vector: [1] }) }),
    embedBatch: async (texts) => {
      if (ctl.gate) await ctl.gate;
      if (ctl.fail === "embed") throw new Error("embed fail");
      return { vectors: texts.map(() => [1, 0]), dim: 2 };
    },
    isRuntimeReady: async () => true,
    readFile: async () => ctl.fileBytes,
    parseFile: async (_k, _b, onProgress): Promise<ParseResult> => {
      if (ctl.fail === "parse") throw new Error("parse fail");
      onProgress?.(0.5);
      onProgress?.(1);
      return {
        pageCount: 2,
        pages: [
          { page: 1, text: `${ctl.text} A` },
          { page: 2, text: `${ctl.text} B` },
        ],
      };
    },
    isVaultLocked: () => ctl.vaultLocked,
    newChunkId: () => `new-${++newId}`,
    emit: (e) => events.push(e),
  });

  // Chen lỗi replaceChunks: bọc repo.
  const realReplace = repo.replaceChunks.bind(repo);
  repo.replaceChunks = (...args) => {
    if (ctl.fail === "replace") throw new Error("sqlite fail");
    realReplace(...args);
  };

  async function ingestOld() {
    const { source } = await pipeline.add({
      notebookId: "nb1",
      kind: "pdf",
      filePath: "/doc.pdf",
    });
    await pipeline.whenIdle();
    // Mô phỏng PDF nạp trước 112: phiên bản trích cũ.
    repo.setExtractionVersion(source.id, 1);
    calls.length = 0;
    events.length = 0;
    return source.id;
  }
  const snapshot = (id: string) => ({
    chunks: repo.listChunks(id).map((c) => [c.id, c.text]),
    vectorIds: [...vectors.keys()].sort(),
    source: repo.getById(id),
  });
  return {
    repo,
    pipeline,
    ctl,
    calls,
    events,
    vectors,
    ingestOld,
    snapshot,
    store,
  };
}

describe("pipeline.reprocess — thành công", () => {
  it("thứ tự add(mới) → replaceChunks → deleteByIds(cũ); version 2; nguồn giữ ready", async () => {
    const h = harness();
    const id = await h.ingestOld();
    const oldIds = h.repo.chunkIds(id);
    h.ctl.text = "New layout text";
    await h.pipeline.reprocess(id);
    await h.pipeline.whenIdle();

    expect(h.calls[0]).toMatch(/^add:/);
    expect(h.calls.at(-1)).toBe(`deleteByIds:${oldIds.join(",")}`);
    const chunks = h.repo.listChunks(id);
    expect(chunks.every((c) => c.id.startsWith("new-"))).toBe(true);
    expect(chunks[0].text).toContain("New layout text");
    expect([...h.vectors.keys()].every((k) => k.startsWith("new-"))).toBe(true);
    const s = h.repo.getById(id)!;
    expect(s.extractionVersion).toBe(2);
    expect(s.status).toBe("ready");
    // mọi sự kiện đều đánh dấu reprocess và status ready; có tiến độ parse theo trang; kết thúc "done"
    expect(h.events.length).toBeGreaterThan(0);
    expect(
      h.events.every((e) => e.reprocess === true && e.status === "ready"),
    ).toBe(true);
    expect(
      h.events.some(
        (e) => e.step === "parse" && e.progress > 0.1 && e.progress < 0.3,
      ),
    ).toBe(true);
    expect(h.events.at(-1)).toMatchObject({ step: "done", progress: 1 });
    expect(h.events.at(-1)!.errorCode).toBeUndefined();
  });

  it("trong lúc chạy, dữ liệu cũ vẫn dùng được (chunk cũ còn tới khi hoán đổi)", async () => {
    const h = harness();
    const id = await h.ingestOld();
    const before = h.snapshot(id);
    let release!: () => void;
    h.ctl.gate = new Promise((r) => (release = r));
    await h.pipeline.reprocess(id);
    await new Promise((r) => setTimeout(r, 5));
    expect(h.snapshot(id).chunks).toEqual(before.chunks);
    expect(h.repo.getById(id)!.status).toBe("ready");
    release();
    await h.pipeline.whenIdle();
    expect(h.repo.getById(id)!.extractionVersion).toBe(2);
  });

  it("nguồn error ⇒ như thử lại bằng cách trích mới (version 2, ready)", async () => {
    const h = harness();
    const id = await h.ingestOld();
    h.repo.updateStatus(id, "error", "extract");
    await h.pipeline.reprocess(id);
    await h.pipeline.whenIdle();
    const s = h.repo.getById(id)!;
    expect(s.status).toBe("ready");
    expect(s.extractionVersion).toBe(2);
  });
});

describe("pipeline.reprocess — lỗi / huỷ ⇒ giữ bản cũ", () => {
  it.each(["parse", "embed", "add", "replace"] as const)(
    "lỗi ở %s ⇒ chunk + vector cũ nguyên vẹn, vector mới bị xoá, nguồn ready, báo lỗi",
    async (step) => {
      const h = harness();
      const id = await h.ingestOld();
      const before = h.snapshot(id);
      h.ctl.fail = step;
      await h.pipeline.reprocess(id);
      await h.pipeline.whenIdle();
      const after = h.snapshot(id);
      expect(after.chunks).toEqual(before.chunks);
      expect(after.vectorIds).toEqual(before.vectorIds);
      expect(after.source!.status).toBe("ready");
      expect(after.source!.extractionVersion).toBe(1);
      expect(h.events.at(-1)).toMatchObject({
        reprocess: true,
        status: "ready",
        errorCode: "reprocessFailed",
      });
    },
  );

  it("lỗi khi xoá vector cũ ⇒ vẫn thành công (vector mồ côi vô hại)", async () => {
    const h = harness();
    const id = await h.ingestOld();
    h.ctl.fail = "deleteOld";
    await h.pipeline.reprocess(id);
    await h.pipeline.whenIdle();
    expect(h.repo.getById(id)!.extractionVersion).toBe(2);
    expect(h.events.at(-1)!.errorCode).toBeUndefined();
  });

  it("huỷ trước khi hoán đổi ⇒ không đổi gì, kết thúc không lỗi", async () => {
    const h = harness();
    const id = await h.ingestOld();
    const before = h.snapshot(id);
    let release!: () => void;
    h.ctl.gate = new Promise((r) => (release = r));
    await h.pipeline.reprocess(id);
    await new Promise((r) => setTimeout(r, 5));
    expect(h.pipeline.cancelReprocess(id)).toBe(true);
    release();
    await h.pipeline.whenIdle();
    expect(h.snapshot(id)).toEqual(before);
    expect(h.events.at(-1)).toMatchObject({ reprocess: true, step: "done" });
    expect(h.events.at(-1)!.errorCode).toBeUndefined();
  });

  it("cancelReprocess khi không có gì đang chạy ⇒ false", async () => {
    const h = harness();
    const id = await h.ingestOld();
    expect(h.pipeline.cancelReprocess(id)).toBe(false);
  });

  it("vault khoá lúc hoán đổi ⇒ huỷ, giữ bản cũ, báo lỗi", async () => {
    const h = harness();
    const id = await h.ingestOld();
    const before = h.snapshot(id);
    h.ctl.vaultLocked = true;
    await h.pipeline.reprocess(id);
    await h.pipeline.whenIdle();
    expect(h.snapshot(id)).toEqual(before);
    expect(h.events.at(-1)!.errorCode).toBe("reprocessVaultLocked");
  });

  it("nguồn bị xoá giữa chừng ⇒ không ghi gì", async () => {
    const h = harness();
    const id = await h.ingestOld();
    let release!: () => void;
    h.ctl.gate = new Promise((r) => (release = r));
    await h.pipeline.reprocess(id);
    await new Promise((r) => setTimeout(r, 5));
    await h.pipeline.remove(id);
    release();
    await h.pipeline.whenIdle();
    expect(h.repo.getById(id)).toBeNull();
    expect(h.vectors.size).toBe(0);
  });

  it("đang trong hàng đợi ⇒ reprocess ném mã reprocessBusy", async () => {
    const h = harness();
    const id = await h.ingestOld();
    let release!: () => void;
    h.ctl.gate = new Promise((r) => (release = r));
    await h.pipeline.reprocess(id);
    await expect(h.pipeline.reprocess(id)).rejects.toThrow("reprocessBusy");
    release();
    await h.pipeline.whenIdle();
  });
});

describe("resumeInterrupted sau khi app đóng giữa lần xử lý lại (E1)", () => {
  it("nguồn ready đang xử lý lại ⇒ vẫn ready dữ liệu cũ, không tự chạy tiếp", async () => {
    const h = harness();
    const id = await h.ingestOld();
    const before = h.snapshot(id);
    // phiên mới: pipeline mới trên cùng DB (hàng đợi RAM đã mất)
    h.pipeline.resumeInterrupted();
    await h.pipeline.whenIdle();
    expect(h.snapshot(id)).toEqual(before);
  });

  it("nguồn error đang xử lý lại (đã về queued/processing) ⇒ về error, thử lại được", async () => {
    const h = harness();
    const id = await h.ingestOld();
    h.repo.updateStatus(id, "processing");
    h.pipeline.resumeInterrupted();
    expect(h.repo.getById(id)!.status).toBe("error");
  });
});

// 112 — sửa theo review.
describe("pipeline.reprocess — sửa theo review (112)", () => {
  it("(B1) huỷ việc đang CHỜ sau một việc khác ⇒ phát done ngay, dọn cờ reprocess", async () => {
    const h = harness();
    const a = await h.ingestOld();
    const { source } = await h.pipeline.add({
      notebookId: "nb1",
      kind: "pdf",
      filePath: "/b.pdf",
    });
    await h.pipeline.whenIdle();
    const b = source.id;
    let release!: () => void;
    h.ctl.gate = new Promise((r) => (release = r));
    await h.pipeline.reprocess(a); // a chạy, kẹt ở embed
    await h.pipeline.reprocess(b); // b chờ sau a
    h.events.length = 0;
    expect(h.pipeline.cancelReprocess(b)).toBe(true);
    const doneB = h.events.filter((e) => e.sourceId === b && e.step === "done");
    expect(doneB).toHaveLength(1);
    expect(doneB[0].reprocess).toBe(true);
    expect(h.pipeline.isReprocessing()).toBe(true); // a vẫn chạy
    release();
    await h.pipeline.whenIdle();
    expect(h.pipeline.isReprocessing()).toBe(false);
    // sự kiện sau này của b không còn cờ reprocess
    h.events.length = 0;
    h.repo.updateStatus(b, "error", "extract");
    await h.pipeline.retry(b);
    await h.pipeline.whenIdle();
    expect(
      h.events.filter((e) => e.sourceId === b).every((e) => !e.reprocess),
    ).toBe(true);
  });

  it("(B2) khoá kho bật trong lúc ghi vector mới ⇒ không hoán đổi, xoá vector mới, giữ bản cũ", async () => {
    const h = harness();
    const id = await h.ingestOld();
    const before = h.snapshot(id);
    const realAdd = h.store.add.bind(h.store);
    h.store.add = async (recs) => {
      h.ctl.vaultLocked = true; // sao lưu bắt đầu đúng lúc này
      await realAdd(recs);
    };
    await h.pipeline.reprocess(id);
    await h.pipeline.whenIdle();
    expect(h.snapshot(id)).toEqual(before);
    expect(h.events.at(-1)!.errorCode).toBe("reprocessVaultLocked");
  });

  it("(B2) isReprocessing() true khi có lần xử lý lại đang chờ/chạy (sao lưu coi là bận)", async () => {
    const h = harness();
    const id = await h.ingestOld();
    expect(h.pipeline.isReprocessing()).toBe(false);
    let release!: () => void;
    h.ctl.gate = new Promise((r) => (release = r));
    await h.pipeline.reprocess(id);
    expect(h.pipeline.isReprocessing()).toBe(true);
    release();
    await h.pipeline.whenIdle();
    expect(h.pipeline.isReprocessing()).toBe(false);
  });

  it("(nên sửa 1) tệp bị sửa trong lúc chờ (hash lúc đọc ≠ content_hash) ⇒ huỷ, giữ bản cũ, báo đã bị sửa", async () => {
    const h = harness();
    const id = await h.ingestOld();
    const before = h.snapshot(id);
    h.ctl.fileBytes = new Uint8Array([9, 9, 9]);
    await h.pipeline.reprocess(id);
    await h.pipeline.whenIdle();
    expect(h.snapshot(id)).toEqual(before);
    expect(h.events.at(-1)!.errorCode).toBe("reprocessChanged");
  });

  it("(nên sửa 2) pipeline.reprocess từ chối nguồn không phải PDF", async () => {
    const h = harness();
    const { source } = await h.pipeline.add({
      notebookId: "nb1",
      kind: "txt",
      filePath: "/a.txt",
    });
    await h.pipeline.whenIdle();
    await expect(h.pipeline.reprocess(source.id)).rejects.toThrow(
      "reprocessNotPdf",
    );
  });

  it("(nên sửa 8) xoá nguồn đang xử lý lại ⇒ dọn cờ reprocess", async () => {
    const h = harness();
    const id = await h.ingestOld();
    let release!: () => void;
    h.ctl.gate = new Promise((r) => (release = r));
    await h.pipeline.reprocess(id);
    await h.pipeline.remove(id);
    expect(h.pipeline.isReprocessing()).toBe(false);
    release();
    await h.pipeline.whenIdle();
  });
});
