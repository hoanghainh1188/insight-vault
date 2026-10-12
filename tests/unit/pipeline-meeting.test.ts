import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { openDatabase } from "../../src/main/db/database";
import { runMigrations } from "../../src/main/db/migrations";
import { createSourceRepo } from "../../src/main/services/ingestion/source-repo";
import { createIngestionPipeline } from "../../src/main/services/ingestion/pipeline";
import { detectKindFromPath } from "../../src/main/services/ingestion/parsers";
import { parseText } from "../../src/main/services/ingestion/parsers/text";
import { buildMeetingTranscript } from "../../src/main/services/meeting-capture/meeting-transcript";
import { createMeetingRepo } from "../../src/main/services/meeting-capture/meeting-repo";
import type { VectorStore } from "../../src/main/services/ingestion/vector-store";
import type { SourceProgressEvent } from "@shared/ipc/types";

// 186 — tích hợp nguồn cuộc họp vào pipeline nguồn (research R9, FR-012..FR-015, SC-012).

function fakeVectorStore() {
  const rows = new Map<string, string>();
  const store = {
    async add(recs: { id: string; sourceId: string }[]) {
      recs.forEach((r) => rows.set(r.id, r.sourceId));
    },
    async deleteBySource(sid: string) {
      for (const [k, v] of rows) if (v === sid) rows.delete(k);
    },
    async deleteByIds(ids: string[]) {
      for (const id of ids) rows.delete(id);
    },
    async deleteByNotebook() {},
    async countBySource(sid: string) {
      return [...rows.values()].filter((v) => v === sid).length;
    },
    async countByNotebook() {
      return rows.size;
    },
    async search() {
      return [];
    },
    async getVectorsByIds() {
      return new Map();
    },
    async dropTable() {},
    async stats() {
      return null;
    },
    async optimize() {
      return null;
    },
    activeOperations: () => 0,
    async close() {},
  } as unknown as VectorStore;
  return { store, rows };
}

function harness() {
  const db = openDatabase(":memory:");
  runMigrations(db);
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES ('nb1','N','#4F46E5',1,1)",
  ).run();
  let t = 1000;
  let n = 0;
  const repo = createSourceRepo(db, {
    now: () => ++t,
    uuid: () => `id-${++n}`,
  });
  const meetingRepo = createMeetingRepo(db, { now: () => t });
  const vs = fakeVectorStore();
  const events: SourceProgressEvent[] = [];
  const removedMeetings: string[] = [];
  // Cổng parse cho nguồn tệp (mô phỏng PDF đang parse lâu) — mở bằng releasePdf().
  let releaseParse!: () => void;
  const parseGate = new Promise<void>((r) => (releaseParse = r));
  const pipeline = createIngestionPipeline({
    sourceRepo: repo,
    vectorStore: vs.store,
    getProvider: () => ({
      embed: async ({ text }) => ({ vector: [text.length % 7, 1, 2] }),
    }),
    isRuntimeReady: async () => true,
    readFile: async () => new TextEncoder().encode("noi dung tep pdf gia lap"),
    parseFile: async (_k, bytes) => {
      await parseGate;
      return parseText(new TextDecoder().decode(bytes));
    },
    hashFile: async () => ({ hash: "h-pdf", byteLength: 10 }),
    emit: (e) => events.push(e),
    onRemoveMeeting: async (id) => {
      removedMeetings.push(id);
    },
  });
  return {
    db,
    repo,
    meetingRepo,
    vs,
    events,
    pipeline,
    removedMeetings,
    releasePdf: () => releaseParse(),
  };
}

const transcript = () =>
  buildMeetingTranscript([
    { text: "Chào mọi người, hôm nay rà soát tiến độ.", tStart: 0, tEnd: 4 },
    {
      text: "Quyết định phát hành cuối tháng mười một.",
      tStart: 600,
      tEnd: 606,
    },
  ]);

describe("createMeetingSource", () => {
  it("tạo nguồn kind=meeting, status=processing, origin meeting:<sessionId>, hash theo sessionId", () => {
    const h = harness();
    const s = h.pipeline.createMeetingSource({
      notebookId: "nb1",
      title: "Cuộc họp 12/10, 14:30",
      sessionId: "sess-1",
    });
    expect(s.kind).toBe("meeting");
    expect(s.status).toBe("processing");
    expect(s.title).toBe("Cuộc họp 12/10, 14:30");
    expect(h.repo.getOrigin(s.id)).toBe("meeting:sess-1");
    expect(h.repo.getRelinkInfo(s.id)?.contentHash).toBe(
      createHash("sha256").update("meeting:sess-1").digest("hex"),
    );
  });

  it("notebookId/title/sessionId rỗng ⇒ ném meetingInvalidInput", () => {
    const h = harness();
    expect(() =>
      h.pipeline.createMeetingSource({
        notebookId: "",
        title: "x",
        sessionId: "s",
      }),
    ).toThrow(/meetingInvalidInput/);
    expect(() =>
      h.pipeline.createMeetingSource({
        notebookId: "nb1",
        title: " ",
        sessionId: "s",
      }),
    ).toThrow(/meetingInvalidInput/);
  });
});

describe("ingestParsed", () => {
  it("chunk + gắn tStart/tEnd từ timeMap (thời gian audio tuyệt đối) ⇒ ready", async () => {
    const h = harness();
    const s = h.pipeline.createMeetingSource({
      notebookId: "nb1",
      title: "Họp",
      sessionId: "s1",
    });
    const tr = transcript();
    const ok = await h.pipeline.ingestParsed(s.id, {
      pages: [{ page: null, text: tr.text }],
      pageCount: null,
      timeMap: tr.timeMap,
    });
    expect(ok).toBe(true);
    expect(h.repo.getById(s.id)?.status).toBe("ready");
    const chunks = h.repo.listChunks(s.id);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].locator.tStart).toBe(0);
    expect(chunks[chunks.length - 1].locator.tEnd).toBe(606);
    expect(await h.vs.store.countBySource(s.id)).toBe(chunks.length);
  });

  it("transcript rỗng ⇒ ready với 0 chunk (nguồn chưa hoàn thiện / không lời nói)", async () => {
    const h = harness();
    const s = h.pipeline.createMeetingSource({
      notebookId: "nb1",
      title: "Họp",
      sessionId: "s1",
    });
    const ok = await h.pipeline.ingestParsed(s.id, {
      pages: [{ page: null, text: "" }],
      pageCount: null,
      timeMap: [],
    });
    expect(ok).toBe(true);
    expect(h.repo.getById(s.id)?.status).toBe("ready");
    expect(h.repo.listChunks(s.id)).toEqual([]);
  });

  it("nguồn không phải meeting ⇒ ném meetingNotSupported", async () => {
    const h = harness();
    h.releasePdf();
    const { source } = await h.pipeline.add({
      notebookId: "nb1",
      kind: "txt",
      filePath: "/a.txt",
    });
    await expect(
      h.pipeline.ingestParsed(source.id, {
        pages: [{ page: null, text: "x" }],
        pageCount: null,
      }),
    ).rejects.toThrow(/meetingNotSupported/);
  });

  it("SC-012: nguồn PDF thêm trước vẫn xong; ingestParsed chỉ chiếm hàng đợi chung ở bước lập chỉ mục", async () => {
    const h = harness();
    const meeting = h.pipeline.createMeetingSource({
      notebookId: "nb1",
      title: "Họp",
      sessionId: "s1",
    });
    const { source: pdf } = await h.pipeline.add({
      notebookId: "nb1",
      kind: "txt",
      filePath: "/b.txt",
    });
    // Bước ASR chốt (ngoài pipeline) đang chạy… PDF đang parse; sau đó cuộc họp mới vào hàng đợi chung.
    const tr = transcript();
    const indexing = h.pipeline.ingestParsed(meeting.id, {
      pages: [{ page: null, text: tr.text }],
      pageCount: null,
      timeMap: tr.timeMap,
    });
    h.releasePdf();
    await indexing;
    await h.pipeline.whenIdle();
    expect(h.repo.getById(pdf.id)?.status).toBe("ready");
    expect(h.repo.getById(meeting.id)?.status).toBe("ready");
  });
});

describe("hành vi riêng cho kind=meeting", () => {
  it("resumeInterrupted bỏ qua meeting (luồng phục hồi riêng xử lý)", async () => {
    const h = harness();
    const s = h.pipeline.createMeetingSource({
      notebookId: "nb1",
      title: "Họp",
      sessionId: "s1",
    });
    h.pipeline.resumeInterrupted();
    expect(h.repo.getById(s.id)?.status).toBe("processing");
  });

  it("retry meeting ⇒ meetingNotSupported", async () => {
    const h = harness();
    const s = h.pipeline.createMeetingSource({
      notebookId: "nb1",
      title: "Họp",
      sessionId: "s1",
    });
    h.repo.updateStatus(s.id, "error", "interrupted");
    await expect(h.pipeline.retry(s.id)).rejects.toThrow(/meetingNotSupported/);
  });

  it("remove meeting gọi onRemoveMeeting (xoá thư mục phiên) rồi xoá nguồn + cascade bảng meeting", async () => {
    const h = harness();
    const s = h.pipeline.createMeetingSource({
      notebookId: "nb1",
      title: "Họp",
      sessionId: "s1",
    });
    h.meetingRepo.create({
      sourceId: s.id,
      sessionId: "s1",
      languageMode: "auto",
      startedAt: 1,
    });
    await h.pipeline.remove(s.id);
    expect(h.removedMeetings).toEqual([s.id]);
    expect(h.repo.getById(s.id)).toBeNull();
    expect(h.meetingRepo.get(s.id)).toBeNull();
  });

  it("remove nguồn thường KHÔNG gọi onRemoveMeeting", async () => {
    const h = harness();
    h.releasePdf();
    const { source } = await h.pipeline.add({
      notebookId: "nb1",
      kind: "txt",
      filePath: "/c.txt",
    });
    await h.pipeline.whenIdle();
    await h.pipeline.remove(source.id);
    expect(h.removedMeetings).toEqual([]);
  });

  it("listByNotebook trả meetingPhase / transcriptQuality cho nguồn cuộc họp", () => {
    const h = harness();
    const s = h.pipeline.createMeetingSource({
      notebookId: "nb1",
      title: "Họp",
      sessionId: "s1",
    });
    h.meetingRepo.create({
      sourceId: s.id,
      sessionId: "s1",
      languageMode: "auto",
      startedAt: 1,
    });
    h.meetingRepo.update(s.id, { phase: "finalizing" });
    const listed = h.repo.listByNotebook("nb1").find((x) => x.id === s.id);
    expect(listed?.meetingPhase).toBe("finalizing");
    h.meetingRepo.update(s.id, { phase: "done", transcriptQuality: "draft" });
    expect(h.repo.getById(s.id)).toMatchObject({
      meetingPhase: "done",
      transcriptQuality: "draft",
    });
  });

  it("detectKindFromPath không bao giờ trả meeting", () => {
    for (const p of [
      "/x.meeting",
      "/meeting.wav",
      "meeting:abc",
      "/a/meeting",
    ]) {
      let kind: string | null = null;
      try {
        kind = detectKindFromPath(p);
      } catch {
        kind = null;
      }
      expect(kind).not.toBe("meeting");
    }
  });
});

describe("ingestParsed — xoá nguồn khi task còn chờ trong hàng đợi", () => {
  it("promise kết thúc false (không treo)", async () => {
    const h = harness();
    const meeting = h.pipeline.createMeetingSource({
      notebookId: "nb1",
      title: "Họp",
      sessionId: "s1",
    });
    await h.pipeline.add({
      notebookId: "nb1",
      kind: "txt",
      filePath: "/d.txt",
    }); // chiếm hàng đợi (parse đang chờ)
    const tr = buildMeetingTranscript([{ text: "a", tStart: 0, tEnd: 1 }]);
    const pending = h.pipeline.ingestParsed(meeting.id, {
      pages: [{ page: null, text: tr.text }],
      pageCount: null,
      timeMap: tr.timeMap,
    });
    await h.pipeline.remove(meeting.id);
    await expect(pending).resolves.toBe(false);
    h.releasePdf();
    await h.pipeline.whenIdle();
  });
});
