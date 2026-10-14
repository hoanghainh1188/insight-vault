import { describe, it, expect, beforeEach, vi } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import { runMigrations } from "../../src/main/db/migrations";
import { createTranslator } from "../../src/shared/i18n";
import type { Source } from "../../src/shared/ipc/types";
import {
  createMeetingRepo,
  type MeetingRepo,
} from "../../src/main/services/meeting-capture/meeting-repo";
import {
  createMeetingViewerApi,
  type MeetingViewerApi,
} from "../../src/main/services/meeting-capture/meeting-viewer";

// 186 PR C2 (T135, US7) — trình xem cuộc họp ở main: transcript + đánh dấu có trích đoạn, đổi nhãn/xoá chỉ đánh dấu của nguồn
// cuộc họp, xuất Markdown dựng ở main (renderer không gửi nội dung).

type Db = ReturnType<typeof openDatabase>;
let db: Db;
let repo: MeetingRepo;
let api: MeetingViewerApi;
let saved: { content: string; name: string }[];
const TEXT = "Chào mọi người. Hôm nay chốt ngân sách. Ai lo báo cáo?";
const sources = new Map<string, Source>();

function addSource(id: string, kind: Source["kind"]): void {
  db.prepare(
    `INSERT INTO source (id, notebook_id, kind, title, origin, status, content_hash, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  ).run(id, "nb1", kind, `Họp *${id}*`, `o:${id}`, "ready", `h-${id}`, 1, 1);
  sources.set(id, {
    id,
    notebookId: "nb1",
    kind,
    title: `Họp *${id}*`,
    status: "ready",
    errorCode: null,
    pageCount: null,
    createdAt: 1,
    updatedAt: 1,
    extractionVersion: 1,
  });
}

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(db);
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES ('nb1','N','#4F46E5',1,1)",
  ).run();
  sources.clear();
  addSource("m1", "meeting");
  addSource("p1", "pdf");
  repo = createMeetingRepo(db, { now: () => 5 });
  repo.create({
    sourceId: "m1",
    sessionId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    languageMode: "vi",
    startedAt: Date.UTC(2026, 9, 12, 7, 30),
  });
  repo.update("m1", {
    phase: "done",
    language: "vi",
    durationMs: 30_000,
    transcriptQuality: "final",
    pauseGaps: [{ atSec: 10, wallSeconds: 120, reason: "user" }],
  });
  repo.replaceSpans("m1", [
    { charStart: 0, charEnd: 15, tStart: 0, tEnd: 5 },
    { charStart: 16, charEnd: 39, tStart: 5, tEnd: 12 },
    { charStart: 40, charEnd: 55, tStart: 12, tEnd: 20 },
  ]);
  repo.addMarker({
    id: "k1",
    sourceId: "m1",
    kind: "decision",
    tStart: 6,
    tEnd: 6,
  });
  saved = [];
  api = createMeetingViewerApi({
    repo,
    sources: {
      getById: (id) => sources.get(id) ?? null,
      setTitle: () => undefined,
    },
    getText: (id) => (id === "m1" ? TEXT : null),
    translator: () => createTranslator("vi"),
    formatDate: () => "12/10/2026 14:30",
    saveMarkdown: async (content, name) => {
      saved.push({ content, name });
      return { saved: true, path: "/tmp/x.md" };
    },
    log: vi.fn(),
  });
});

describe("meeting-viewer (PR C2)", () => {
  it("getTranscript: câu, đánh dấu kèm trích đoạn, khoảng ngừng, ngôn ngữ, chất lượng", () => {
    const t = api.getTranscript({ sourceId: "m1" });
    expect(t.spans).toHaveLength(3);
    expect(t.markers).toEqual([
      {
        id: "k1",
        kind: "decision",
        tStart: 6,
        tEnd: 6,
        excerpt: "Hôm nay chốt ngân sách.",
      },
    ]);
    expect(t).toMatchObject({
      pauseGaps: [{ atSec: 10, wallSeconds: 120, reason: "user" }],
      language: "vi",
      quality: "final",
      durationSec: 30,
    });
  });

  it("chỉ nguồn cuộc họp", () => {
    expect(() => api.getTranscript({ sourceId: "p1" })).toThrow(
      "meetingNotFound",
    );
    expect(() => api.getTranscript({})).toThrow("meetingNotFound");
  });

  it("updateMarker / deleteMarker: kiểm nhãn + đánh dấu phải thuộc nguồn cuộc họp", () => {
    api.updateMarker({ markerId: "k1", kind: "question" });
    expect(repo.listMarkers("m1")[0]?.kind).toBe("question");
    expect(() => api.updateMarker({ markerId: "k1", kind: "note" })).toThrow(
      "meetingInvalidInput",
    );
    expect(() =>
      api.updateMarker({ markerId: "khác", kind: "question" }),
    ).toThrow("meetingNotFound");
    api.deleteMarker({ markerId: "k1" });
    expect(repo.listMarkers("m1")).toEqual([]);
    expect(() => api.deleteMarker({ markerId: "k1" })).toThrow(
      "meetingNotFound",
    );
  });

  it("exportMarkdown: dựng ở main (tiêu đề escape, đánh dấu, [hh:mm:ss], dòng tạm dừng), tên gợi ý = tiêu đề", async () => {
    const r = await api.exportMarkdown({ sourceId: "m1" });
    expect(r).toEqual({ saved: true, path: "/tmp/x.md" });
    const md = saved[0]?.content ?? "";
    expect(md).toContain("# Họp \\*m1\\*");
    expect(md).toContain("- Ngày: 12/10/2026 14:30");
    expect(md).toContain("**Quyết định** — Hôm nay chốt ngân sách.");
    expect(md).toContain("[00:00:05] Hôm nay chốt ngân sách.");
    expect(md).toContain("Tạm dừng 00:02:00");
    expect(saved[0]?.name).toBe("Họp *m1*");
  });
});
