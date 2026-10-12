import { describe, it, expect, beforeEach } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import { runMigrations } from "../../src/main/db/migrations";
import {
  createMeetingRepo,
  type MeetingRepo,
} from "../../src/main/services/meeting-capture/meeting-repo";

// 186 — repo meeting_session / transcript_span (data-model §2). DB tạm :memory: ở schema mới nhất.

type Db = ReturnType<typeof openDatabase>;
let db: Db;
let repo: MeetingRepo;
let clock = 100;

function addSource(id: string): void {
  db.prepare(
    `INSERT INTO source (id, notebook_id, kind, title, origin, status, content_hash, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    "nb1",
    "meeting",
    "Họp",
    `meeting:${id}`,
    "processing",
    `h-${id}`,
    1,
    1,
  );
}

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(db);
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES ('nb1','N','#4F46E5',1,1)",
  ).run();
  addSource("m1");
  clock = 100;
  repo = createMeetingRepo(db, { now: () => clock });
});

describe("meeting-repo — phiên", () => {
  it("create ⇒ phase recording + mặc định; get / getBySessionId", () => {
    const s = repo.create({
      sourceId: "m1",
      sessionId: "sess-1",
      languageMode: "vi",
      deviceLabel: "Mic A",
      startedAt: 50,
    });
    expect(s).toEqual({
      sourceId: "m1",
      sessionId: "sess-1",
      phase: "recording",
      endedByUser: false,
      languageMode: "vi",
      language: null,
      languageChanges: [],
      deviceLabel: "Mic A",
      startedAt: 50,
      endedAt: null,
      durationMs: 0,
      segments: [],
      pauseGaps: [],
      transcriptQuality: null,
      finalProgress: 0,
      updatedAt: 100,
    });
    expect(repo.get("m1")).toEqual(s);
    expect(repo.getBySessionId("sess-1")).toEqual(s);
    expect(repo.get("nope")).toBeNull();
    expect(repo.getBySessionId("nope")).toBeNull();
  });

  it("update chỉ đổi trường được truyền + updated_at", () => {
    repo.create({
      sourceId: "m1",
      sessionId: "sess-1",
      languageMode: "auto",
      startedAt: 50,
    });
    clock = 200;
    repo.update("m1", {
      phase: "paused",
      durationMs: 3000,
      segments: [
        { index: 0, file: "seg-0000.wav", samples: 48000, closed: true },
      ],
      pauseGaps: [{ atSec: 3, wallSeconds: 60, reason: "user" }],
    });
    const s = repo.get("m1");
    expect(s?.phase).toBe("paused");
    expect(s?.durationMs).toBe(3000);
    expect(s?.segments).toEqual([
      { index: 0, file: "seg-0000.wav", samples: 48000, closed: true },
    ]);
    expect(s?.pauseGaps).toEqual([
      { atSec: 3, wallSeconds: 60, reason: "user" },
    ]);
    expect(s?.languageMode).toBe("auto");
    expect(s?.updatedAt).toBe(200);
    repo.update("m1", {
      phase: "done",
      endedByUser: true,
      endedAt: 999,
      transcriptQuality: "final",
      finalProgress: 2,
    });
    expect(repo.get("m1")).toMatchObject({
      phase: "done",
      endedByUser: true,
      endedAt: 999,
      transcriptQuality: "final",
      finalProgress: 2,
    });
  });

  it("listByPhase", () => {
    addSource("m2");
    addSource("m3");
    repo.create({
      sourceId: "m1",
      sessionId: "s1",
      languageMode: "auto",
      startedAt: 1,
    });
    repo.create({
      sourceId: "m2",
      sessionId: "s2",
      languageMode: "auto",
      startedAt: 1,
    });
    repo.create({
      sourceId: "m3",
      sessionId: "s3",
      languageMode: "auto",
      startedAt: 1,
    });
    repo.update("m2", { phase: "finalizing" });
    repo.update("m3", { phase: "done" });
    expect(
      repo
        .listByPhase(["recording", "finalizing"])
        .map((s) => s.sourceId)
        .sort(),
    ).toEqual(["m1", "m2"]);
    expect(repo.listByPhase([])).toEqual([]);
  });

  it("JSON hỏng trong DB ⇒ mảng rỗng, không ném", () => {
    repo.create({
      sourceId: "m1",
      sessionId: "s1",
      languageMode: "auto",
      startedAt: 1,
    });
    db.prepare(
      "UPDATE meeting_session SET segments_json='{oops', pause_gaps_json='42' WHERE source_id='m1'",
    ).run();
    const s = repo.get("m1");
    expect(s?.segments).toEqual([]);
    expect(s?.pauseGaps).toEqual([]);
  });
});

describe("meeting-repo — transcript_span", () => {
  it("replaceSpans xoá-rồi-chèn trong giao dịch; listSpans theo idx", () => {
    repo.replaceSpans("m1", [
      { charStart: 0, charEnd: 3, tStart: 0, tEnd: 1 },
      { charStart: 4, charEnd: 9, tStart: 1, tEnd: 2.5 },
    ]);
    repo.replaceSpans("m1", [{ charStart: 0, charEnd: 5, tStart: 0, tEnd: 2 }]);
    expect(repo.listSpans("m1")).toEqual([
      { charStart: 0, charEnd: 5, tStart: 0, tEnd: 2 },
    ]);
  });

  it("lỗi giữa chừng ⇒ rollback, giữ span cũ", () => {
    repo.replaceSpans("m1", [{ charStart: 0, charEnd: 3, tStart: 0, tEnd: 1 }]);
    expect(() =>
      repo.replaceSpans("m1", [
        { charStart: 0, charEnd: 2, tStart: 0, tEnd: 1 },
        { charStart: 5, charEnd: 5, tStart: 1, tEnd: 2 }, // vi phạm CHECK char_end > char_start
      ]),
    ).toThrow();
    expect(repo.listSpans("m1")).toEqual([
      { charStart: 0, charEnd: 3, tStart: 0, tEnd: 1 },
    ]);
  });
});
