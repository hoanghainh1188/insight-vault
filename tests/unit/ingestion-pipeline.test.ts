import { describe, it, expect } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import { runMigrations } from "../../src/main/db/migrations";
import { createSourceRepo } from "../../src/main/services/ingestion/source-repo";
import { createIngestionPipeline } from "../../src/main/services/ingestion/pipeline";
import { parseText } from "../../src/main/services/ingestion/parsers/text";
import type { VectorStore } from "../../src/main/services/ingestion/vector-store";
import type { SourceProgressEvent } from "@shared/ipc/types";

function fakeVectorStore() {
  const rows = new Map<string, { sourceId: string; notebookId: string }>();
  const store: VectorStore = {
    async add(recs) {
      recs.forEach((r) =>
        rows.set(r.id, { sourceId: r.sourceId, notebookId: r.notebookId }),
      );
    },
    async deleteBySource(sid) {
      for (const [k, v] of rows) if (v.sourceId === sid) rows.delete(k);
    },
    async deleteByNotebook(nid) {
      for (const [k, v] of rows) if (v.notebookId === nid) rows.delete(k);
    },
    async countBySource(sid) {
      let c = 0;
      for (const v of rows.values()) if (v.sourceId === sid) c++;
      return c;
    },
    async close() {},
  };
  return { store, rows };
}

const enc = (s: string) => new TextEncoder().encode(s);
const bigText = Array.from(
  { length: 300 },
  (_, i) => `cau ${i} noi dung.`,
).join(" ");

function harness(opts: { ready?: boolean; parseThrows?: boolean } = {}) {
  const db = openDatabase(":memory:");
  runMigrations(db);
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
  ).run("nb1", "N", "#4F46E5", 1, 1);
  let t = 1000;
  let n = 0;
  const repo = createSourceRepo(db, {
    now: () => ++t,
    uuid: () => `id-${++n}`,
  });
  const vs = fakeVectorStore();
  const events: SourceProgressEvent[] = [];
  let ready = opts.ready ?? true;
  const flags = { parseThrows: opts.parseThrows ?? false, embedThrows: false };

  const files: Record<string, string> = {
    "/doc.txt": bigText,
    "/small.txt": "noi dung ngan",
  };

  // Gate embed: nếu set, mỗi lần embed sẽ chờ tới khi test release → mô phỏng embed đang chạy dở (B2).
  let embedGate: Promise<void> | null = null;
  const online: boolean[] = []; // ghi lại các lần bật/tắt privacy online (US2)

  const pipeline = createIngestionPipeline({
    sourceRepo: repo,
    vectorStore: vs.store,
    getProvider: () => ({
      embed: async ({ text }) => {
        if (embedGate) await embedGate;
        if (flags.embedThrows) throw new Error("embed fail");
        return { vector: [text.length % 10, 1, 2] };
      },
    }),
    isRuntimeReady: async () => ready,
    readFile: async (p) => enc(files[p] ?? ""),
    parseFile: async (_kind, bytes) => {
      if (flags.parseThrows) throw new Error("parse fail");
      return parseText(new TextDecoder().decode(bytes));
    },
    parseUrl: async (url) => {
      if (flags.parseThrows) throw new Error("fetch fail");
      return {
        pageCount: null,
        title: `Tiêu đề của ${url}`,
        pages: [{ page: null, text: bigText }],
      };
    },
    setOnline: (v) => online.push(v),
    emit: (e) => events.push(e),
  });

  return {
    pipeline,
    repo,
    vs,
    events,
    db,
    online,
    setReady: (v: boolean) => (ready = v),
    setParseThrows: (v: boolean) => (flags.parseThrows = v),
    setEmbedThrows: (v: boolean) => (flags.embedThrows = v),
    gateEmbed: (): (() => void) => {
      let release!: () => void;
      embedGate = new Promise<void>((r) => (release = r));
      return () => {
        embedGate = null;
        release();
      };
    },
  };
}

describe("ingestion pipeline", () => {
  it("US1: add tệp txt → ready, có chunk + vector khớp id", async () => {
    const h = harness();
    const { source } = await h.pipeline.add({
      notebookId: "nb1",
      kind: "txt",
      filePath: "/doc.txt",
    });
    expect(source.status).toBe("queued");
    await h.pipeline.whenIdle();
    const after = h.repo.getById(source.id)!;
    expect(after.status).toBe("ready");
    const chunks = h.repo.listChunks(source.id);
    expect(chunks.length).toBeGreaterThan(1);
    expect(await h.vs.store.countBySource(source.id)).toBe(chunks.length);
    // progress phát tới done/ready
    expect(
      h.events.some((e) => e.step === "done" && e.status === "ready"),
    ).toBe(true);
  });

  it("US1: duplicateWarning khi thêm lại cùng nội dung trong notebook", async () => {
    const h = harness();
    const a = await h.pipeline.add({
      notebookId: "nb1",
      kind: "txt",
      filePath: "/doc.txt",
    });
    await h.pipeline.whenIdle();
    expect(a.duplicateWarning).toBe(false);
    const b = await h.pipeline.add({
      notebookId: "nb1",
      kind: "txt",
      filePath: "/doc.txt",
    });
    expect(b.duplicateWarning).toBe(true);
  });

  it("US4: runtime offline → awaiting_embedding (có chunk, chưa vector); resume → ready", async () => {
    const h = harness({ ready: false });
    const { source } = await h.pipeline.add({
      notebookId: "nb1",
      kind: "txt",
      filePath: "/doc.txt",
    });
    await h.pipeline.whenIdle();
    expect(h.repo.getById(source.id)!.status).toBe("awaiting_embedding");
    expect(h.repo.listChunks(source.id).length).toBeGreaterThan(0);
    expect(await h.vs.store.countBySource(source.id)).toBe(0);

    h.setReady(true);
    await h.pipeline.resumeAwaiting();
    await h.pipeline.whenIdle();
    expect(h.repo.getById(source.id)!.status).toBe("ready");
    expect(await h.vs.store.countBySource(source.id)).toBeGreaterThan(0);
  });

  it("US3: tệp quá lớn → error 'Tệp quá lớn', không đưa vào hàng đợi", async () => {
    const huge = "x".repeat(26 * 1024 * 1024); // txt limit 25MB
    const h2 = harnessWithFile("/huge.txt", huge);
    const { source } = await h2.pipeline.add({
      notebookId: "nb1",
      kind: "txt",
      filePath: "/huge.txt",
    });
    expect(source.status).toBe("error");
    expect(source.errorLabel).toBe("Tệp quá lớn");
    await h2.pipeline.whenIdle();
    expect(h2.repo.listChunks(source.id)).toHaveLength(0);
  });

  it("US3: parse lỗi → error 'Lỗi trích xuất', nguồn kế vẫn chạy (không chặn hàng đợi)", async () => {
    const h = harness({ parseThrows: true });
    const a = await h.pipeline.add({
      notebookId: "nb1",
      kind: "txt",
      filePath: "/doc.txt",
    });
    await h.pipeline.whenIdle();
    expect(h.repo.getById(a.source.id)!.status).toBe("error");
    expect(h.repo.getById(a.source.id)!.errorLabel).toBe("Lỗi trích xuất");
  });

  it("US3: retry nguồn lỗi → ready", async () => {
    const h = harness({ parseThrows: true });
    const a = await h.pipeline.add({
      notebookId: "nb1",
      kind: "txt",
      filePath: "/doc.txt",
    });
    await h.pipeline.whenIdle();
    expect(h.repo.getById(a.source.id)!.status).toBe("error");
    // cho phép parse thành công ở lần retry → nguồn về ready
    h.setParseThrows(false);
    const q = await h.pipeline.retry(a.source.id);
    expect(q.status).toBe("queued");
    await h.pipeline.whenIdle();
    expect(h.repo.getById(a.source.id)!.status).toBe("ready");
  });

  it("US3: remove nguồn → xoá SQLite (cascade chunk) + vector", async () => {
    const h = harness();
    const { source } = await h.pipeline.add({
      notebookId: "nb1",
      kind: "txt",
      filePath: "/doc.txt",
    });
    await h.pipeline.whenIdle();
    expect(await h.vs.store.countBySource(source.id)).toBeGreaterThan(0);
    await h.pipeline.remove(source.id);
    expect(h.repo.getById(source.id)).toBeNull();
    expect(h.repo.listChunks(source.id)).toHaveLength(0);
    expect(await h.vs.store.countBySource(source.id)).toBe(0);
  });

  it("B2: xoá nguồn khi ĐANG embed → KHÔNG ghi vector mồ côi", async () => {
    const h = harness();
    const release = h.gateEmbed(); // chặn embed để mô phỏng đang chạy dở
    const { source } = await h.pipeline.add({
      notebookId: "nb1",
      kind: "txt",
      filePath: "/doc.txt",
    });
    // Chờ pipeline chạy tới bước embed (đang kẹt ở gate).
    await expect
      .poll(() => h.repo.listChunks(source.id).length, { timeout: 2000 })
      .toBeGreaterThan(0);

    // Xoá giữa lúc embed đang chờ → dọn SQLite + vector.
    await h.pipeline.remove(source.id);
    release(); // cho embed chạy tiếp
    await h.pipeline.whenIdle();

    // Không được ghi lại vector cho nguồn đã xoá (SC-003: không mồ côi).
    expect(h.repo.getById(source.id)).toBeNull();
    expect(await h.vs.store.countBySource(source.id)).toBe(0);
  });

  it("US2: nạp URL → ready, bật rồi tắt privacy online, tiêu đề trang cập nhật", async () => {
    const h = harness();
    const { source } = await h.pipeline.add({
      notebookId: "nb1",
      kind: "url",
      url: "https://vidu.com/bai-viet",
    });
    await h.pipeline.whenIdle();
    const after = h.repo.getById(source.id)!;
    expect(after.status).toBe("ready");
    expect(after.title).toContain("Tiêu đề của");
    // privacy: bật (true) rồi tắt (false) quanh fetch
    expect(h.online).toEqual([true, false]);
    expect(await h.vs.store.countBySource(source.id)).toBeGreaterThan(0);
  });

  it("add: input không hợp lệ ở boundary → ném (không tạo nguồn)", async () => {
    const h = harness();
    await expect(
      h.pipeline.add({ notebookId: "", kind: "txt", filePath: "/doc.txt" }),
    ).rejects.toThrow(/notebookId/);
    await expect(
      h.pipeline.add({ notebookId: "nb1", kind: "url", url: "  " }),
    ).rejects.toThrow(/thiếu đường dẫn|URL/);
    expect(h.repo.listByNotebook("nb1")).toHaveLength(0);
  });

  it("retry nguồn KHÔNG ở trạng thái error → ném", async () => {
    const h = harness();
    const { source } = await h.pipeline.add({
      notebookId: "nb1",
      kind: "txt",
      filePath: "/doc.txt",
    });
    await h.pipeline.whenIdle();
    await expect(h.pipeline.retry(source.id)).rejects.toThrow(/đang lỗi/);
    await expect(h.pipeline.retry("khong-co")).rejects.toThrow(/không tồn tại/);
  });

  it("resumeAwaiting: embed lỗi → nguồn chuyển error", async () => {
    const h = harness({ ready: false });
    const { source } = await h.pipeline.add({
      notebookId: "nb1",
      kind: "txt",
      filePath: "/doc.txt",
    });
    await h.pipeline.whenIdle();
    expect(h.repo.getById(source.id)!.status).toBe("awaiting_embedding");
    // runtime sẵn sàng nhưng embed ném → nguồn chuyển 'error' (không kẹt awaiting).
    h.setReady(true);
    h.setEmbedThrows(true);
    await h.pipeline.resumeAwaiting();
    await h.pipeline.whenIdle();
    const s = h.repo.getById(source.id)!;
    expect(s.status).toBe("error");
    expect(s.errorLabel).toBe("Lỗi nhúng");
  });

  it("B3: resumeInterrupted → nguồn kẹt queued/processing thành error (retry được)", async () => {
    const h = harness();
    // Giả lập trạng thái kẹt từ phiên trước: chèn thẳng source ở 'processing'.
    h.db
      .prepare(
        "INSERT INTO source (id, notebook_id, kind, title, origin, status, content_hash, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
      )
      .run("stuck", "nb1", "txt", "t", "/doc.txt", "processing", "h", 1, 1);
    h.pipeline.resumeInterrupted();
    const s = h.repo.getById("stuck")!;
    expect(s.status).toBe("error");
    expect(s.errorLabel).toMatch(/Gián đoạn/);

    // retry được (origin đọc từ DB dù originCache rỗng sau "restart") → về ready.
    await h.pipeline.retry("stuck");
    await h.pipeline.whenIdle();
    expect(h.repo.getById("stuck")!.status).toBe("ready");
  });
});

// Harness biến thể cho file tuỳ ý (test giới hạn kích thước).
function harnessWithFile(path: string, content: string) {
  const db = openDatabase(":memory:");
  runMigrations(db);
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
  ).run("nb1", "N", "#4F46E5", 1, 1);
  let t = 1000;
  let n = 0;
  const repo = createSourceRepo(db, {
    now: () => ++t,
    uuid: () => `id-${++n}`,
  });
  const vs = fakeVectorStore();
  const pipeline = createIngestionPipeline({
    sourceRepo: repo,
    vectorStore: vs.store,
    getProvider: () => ({ embed: async () => ({ vector: [1, 2, 3] }) }),
    isRuntimeReady: async () => true,
    readFile: async (p) => new TextEncoder().encode(p === path ? content : ""),
    parseFile: async (_k, bytes) => parseText(new TextDecoder().decode(bytes)),
    emit: () => {},
  });
  return { pipeline, repo, vs };
}
