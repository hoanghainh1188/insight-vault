import { describe, it, expect, beforeEach } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import { runMigrations } from "../../src/main/db/migrations";
import {
  createMeetingRepo,
  type MeetingRepo,
} from "../../src/main/services/meeting-capture/meeting-repo";
import {
  createMeetingService,
  type MeetingService,
  type MeetingFiles,
  type SegmentWriter,
  type AsrFinalClient,
  type MeetingServiceDeps,
  AsrError,
} from "../../src/main/services/meeting-capture/meeting-service";
import { createMicGate } from "../../src/main/services/app-shell/permissions";
import type { SegmentRecord } from "../../src/main/services/meeting-capture/segments";
import type { Segment } from "../../src/main/services/ingestion/audio/audio-transcript";
import type { MeetingState, Source } from "@shared/ipc/types";

// 186 — điều phối phiên ghi (research R4, R8, R12; data-model §5). Mọi I/O (tệp, ASR, đĩa, cửa sổ) là fake tiêm vào.

const RATE = 16000;
const SEC = RATE * 2; // byte / giây
const OWNER = 7;

interface Harness {
  svc: MeetingService;
  repo: MeetingRepo;
  sources: Map<string, Source>;
  writers: { index: number; bytes: number; closed: boolean }[];
  files: Map<string, Map<number, Segment[]>>; // sessionId → index → final
  merged: string[];
  deletedSegments: string[];
  deletedSessions: string[];
  pushes: MeetingState[];
  progress: number[];
  ingested: { sourceId: string; text: string; timeMap: unknown }[];
  notified: string[];
  asrCalls: {
    segmentPath: string;
    prevSegmentPath?: string;
    overlapSec: number;
    language: string | null;
  }[];
  clock: { now: number };
  tick: () => void;
  setAsr: (fn: AsrFinalClient["final"]) => void;
  setFree: (bytes: number) => void;
  idle: () => Promise<void>;
  recreate: () => MeetingService;
}

function harness(
  opts: {
    segmentSeconds?: number;
    micStatus?: "granted" | "denied";
    testFakeMic?: boolean;
  } = {},
): Harness {
  const db = openDatabase(":memory:");
  runMigrations(db);
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES ('nb1','N','#4F46E5',1,1)",
  ).run();
  const clock = { now: 1_000_000 };
  const repo = createMeetingRepo(db, { now: () => clock.now });
  const sources = new Map<string, Source>();
  const writers: Harness["writers"] = [];
  const finals = new Map<string, Map<number, Segment[]>>();
  const merged: string[] = [];
  const deletedSegments: string[] = [];
  const deletedSessions: string[] = [];
  const pushes: MeetingState[] = [];
  const progress: number[] = [];
  const ingested: Harness["ingested"] = [];
  const notified: string[] = [];
  const asrCalls: Harness["asrCalls"] = [];
  let free = 50 * 1024 * 1024 * 1024;
  let idSeq = 0;
  let intervalFn: (() => void) | null = null;
  // Mặc định ASR trả một câu cho mỗi phân đoạn, thời gian tương đối đầu phân đoạn.
  let asrImpl: AsrFinalClient["final"] = async (req) => [
    { text: `câu của ${req.segmentPath.split("/").pop()}`, tStart: 1, tEnd: 3 },
  ];

  const files: MeetingFiles = {
    meetingsRoot: "/data/meetings",
    segmentPath: (sid, i) =>
      `/data/meetings/${sid}/seg-${String(i).padStart(4, "0")}.wav`,
    ensureSessionDir: async () => undefined,
    openWriter: (_sid, index): SegmentWriter => {
      const w = { index, bytes: 0, closed: false };
      writers.push(w);
      return {
        append: (b) => {
          w.bytes += b.byteLength;
        },
        samples: () => w.bytes / 2,
        close: async () => {
          w.closed = true;
          return w.bytes / 2;
        },
      };
    },
    repairSegments: async (_sid, segs) =>
      segs.map((s) => ({ ...s, samples: s.samples + RATE, closed: true })),
    readFinal: async (sid, i) => finals.get(sid)?.get(i) ?? null,
    writeFinal: async (sid, i, segs) => {
      if (!finals.has(sid)) finals.set(sid, new Map());
      finals.get(sid)!.set(i, [...segs]);
    },
    mergeSegments: async (sid) => {
      merged.push(sid);
    },
    deleteSegments: async (sid) => {
      deletedSegments.push(sid);
    },
    deleteSession: async (sid) => {
      deletedSessions.push(sid);
    },
  };

  const deps: MeetingServiceDeps = {
    repo,
    pipeline: {
      createMeetingSource: ({ notebookId, title, sessionId }) => {
        const s: Source = {
          id: `src-${++idSeq}`,
          notebookId,
          kind: "meeting",
          title,
          status: "processing",
          errorCode: null,
          pageCount: null,
          createdAt: 1,
          updatedAt: 1,
          extractionVersion: 1,
        };
        sources.set(s.id, s);
        db.prepare(
          `INSERT INTO source (id, notebook_id, kind, title, origin, status, content_hash, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?)`,
        ).run(
          s.id,
          notebookId,
          "meeting",
          title,
          `meeting:${sessionId}`,
          "processing",
          `h-${sessionId}`,
          1,
          1,
        );
        return s;
      },
      ingestParsed: async (sourceId, parsed) => {
        ingested.push({
          sourceId,
          text: parsed.pages.map((p) => p.text).join(""),
          timeMap: parsed.timeMap,
        });
        return true;
      },
    },
    sources: {
      getById: (id) => sources.get(id) ?? null,
      setTitle: (id, title) => {
        const s = sources.get(id);
        if (s) sources.set(id, { ...s, title });
      },
    },
    notebookExists: (id) => id === "nb1",
    files,
    asr: { final: (req) => (asrCalls.push(req), asrImpl(req)) },
    freeBytes: async () => free,
    micGate: createMicGate(() => clock.now, 15_000),
    mediaAccess: {
      status: () => opts.micStatus ?? "granted",
      ask: async () => (opts.micStatus ?? "granted") === "granted",
    },
    isOnlineActive: () => false,
    isModelReady: async () => true,
    prefs: { get: () => undefined, set: () => undefined },
    push: (_id, st) => pushes.push(st),
    emitProgress: (_src, _nb, frac) => progress.push(frac),
    notifyReady: (sourceId) => notified.push(sourceId),
    now: () => clock.now,
    uuid: () => `sess-${++idSeq}`,
    setInterval: (fn) => {
      intervalFn = fn;
      return 1 as unknown as ReturnType<typeof setInterval>;
    },
    clearInterval: () => {
      intervalFn = null;
    },
    segmentSeconds: opts.segmentSeconds ?? 300,
    sampleRate: RATE,
    ...(opts.testFakeMic ? { testFakeMic: true } : {}),
  };
  const svc = createMeetingService(deps);
  return {
    svc,
    repo,
    sources,
    writers,
    files: finals,
    merged,
    deletedSegments,
    deletedSessions,
    pushes,
    progress,
    ingested,
    notified,
    asrCalls,
    clock,
    tick: () => intervalFn?.(),
    setAsr: (fn) => (asrImpl = fn),
    setFree: (b) => (free = b),
    idle: () => svc.whenIdle(),
    recreate: () => createMeetingService(deps),
  };
}

/** Gửi `seconds` lô 1 s liên tiếp, mỗi lô cách 1000 ms. */
function feed(
  h: Harness,
  sessionId: string,
  seconds: number,
  startSeq = 0,
): number {
  let seq = startSeq;
  for (let i = 0; i < seconds; i++) {
    h.clock.now += 1000;
    h.svc.acceptAudio(OWNER, {
      sessionId,
      seq: seq++,
      pcm: new ArrayBuffer(SEC),
    });
  }
  return seq;
}

async function startSession(h: Harness, title = "Cuộc họp 12/10, 14:30") {
  await h.svc.prepare(OWNER, { notebookId: "nb1" });
  return h.svc.start(OWNER, {
    notebookId: "nb1",
    title,
    languageMode: "vi",
    deviceLabel: "Mic A",
  });
}

let h: Harness;
beforeEach(() => {
  h = harness();
});

describe("prepare / start", () => {
  it("prepare trả trạng thái micro, đĩa, model; canStart khi đủ điều kiện", async () => {
    const r = await h.svc.prepare(OWNER, { notebookId: "nb1" });
    expect(r).toMatchObject({
      micStatus: "granted",
      modelReady: true,
      canStart: true,
      recordingActive: false,
      onlineActive: false,
    });
    expect(r.minutesRemaining).toBeGreaterThan(10);
  });

  it("e2e testFakeMic ⇒ coi như có quyền, báo renderer dùng tín hiệu thử", async () => {
    const f = harness({ micStatus: "denied", testFakeMic: true });
    const r = await f.svc.prepare(OWNER, { notebookId: "nb1" });
    expect(r).toMatchObject({
      micStatus: "granted",
      canStart: true,
      testFakeMic: true,
    });
    expect(
      (await h.svc.prepare(OWNER, { notebookId: "nb1" })).testFakeMic,
    ).toBeUndefined();
  });

  it("micro bị từ chối ⇒ canStart=false, micStatus=denied", async () => {
    const d = harness({ micStatus: "denied" });
    const r = await d.svc.prepare(OWNER, { notebookId: "nb1" });
    expect(r.micStatus).toBe("denied");
    expect(r.canStart).toBe(false);
  });

  it("đĩa < 10 phút ⇒ canStart=false và start ném meetingDiskLow", async () => {
    h.setFree(400 * 1024 * 1024);
    expect((await h.svc.prepare(OWNER, { notebookId: "nb1" })).canStart).toBe(
      false,
    );
    await expect(
      h.svc.start(OWNER, {
        notebookId: "nb1",
        title: "x",
        languageMode: "auto",
      }),
    ).rejects.toThrow(/meetingDiskLow/);
    expect(h.sources.size).toBe(0);
  });

  it("start tạo nguồn + phiên recording + phân đoạn 0 đang mở; push state", async () => {
    const { sessionId, sourceId } = await startSession(h);
    expect(h.sources.get(sourceId)?.kind).toBe("meeting");
    const s = h.repo.get(sourceId);
    expect(s).toMatchObject({
      sessionId,
      phase: "recording",
      languageMode: "vi",
      deviceLabel: "Mic A",
    });
    expect(s?.segments).toEqual([
      { index: 0, file: "seg-0000.wav", samples: 0, closed: false },
    ]);
    expect(h.svc.status()).toMatchObject({
      sessionId,
      sourceId,
      phase: "recording",
      durationSec: 0,
    });
  });

  it("chỉ một phiên tại một thời điểm ⇒ meetingAlreadyRecording", async () => {
    await startSession(h);
    await expect(startSession(h)).rejects.toThrow(/meetingAlreadyRecording/);
  });

  it.each([
    [
      { notebookId: "nb1", title: "  ", languageMode: "auto" },
      /meetingInvalidInput/,
    ],
    [
      { notebookId: "nb1", title: "x".repeat(201), languageMode: "auto" },
      /meetingInvalidInput/,
    ],
    [
      { notebookId: "nb1", title: "x", languageMode: "fr" },
      /meetingInvalidInput/,
    ],
    [
      { notebookId: "khong-co", title: "x", languageMode: "auto" },
      /notebookNotFound/,
    ],
  ])("đầu vào sai %j ⇒ lỗi, không tạo nguồn", async (input, err) => {
    await expect(h.svc.start(OWNER, input as never)).rejects.toThrow(err);
    expect(h.sources.size).toBe(0);
  });
});

describe("ghi audio", () => {
  it("lô hợp lệ ⇒ ghi vào phân đoạn, thời lượng tăng; lô sai bị bỏ", async () => {
    const { sessionId } = await startSession(h);
    feed(h, sessionId, 3);
    h.svc.acceptAudio(99, { sessionId, seq: 3, pcm: new ArrayBuffer(SEC) }); // sai sender
    h.svc.acceptAudio(OWNER, {
      sessionId: "khac",
      seq: 3,
      pcm: new ArrayBuffer(SEC),
    });
    expect(h.writers[0].bytes).toBe(3 * SEC);
    expect(h.svc.status()?.durationSec).toBe(3);
  });

  it("đủ độ dài phân đoạn ⇒ đóng phân đoạn, mở phân đoạn mới, lưu danh sách", async () => {
    const short = harness({ segmentSeconds: 5 });
    const { sessionId, sourceId } = await startSession(short);
    feed(short, sessionId, 7);
    await short.svc.whenIdle();
    const segs = short.repo.get(sourceId)?.segments as SegmentRecord[];
    expect(segs.map((s) => [s.index, s.samples, s.closed])).toEqual([
      [0, 5 * RATE, true],
      [1, 0, false],
    ]);
    expect(short.writers[0].closed).toBe(true);
    expect(short.writers[1].bytes).toBe(2 * SEC);
    expect(short.svc.status()?.durationSec).toBe(7);
  });

  it("seq nhảy (renderer mất lô) ⇒ ghi nhận khoảng ngừng 'interrupted'", async () => {
    const { sessionId, sourceId } = await startSession(h);
    feed(h, sessionId, 2);
    h.clock.now += 1000;
    h.svc.acceptAudio(OWNER, { sessionId, seq: 5, pcm: new ArrayBuffer(SEC) });
    await h.svc.whenIdle();
    expect(h.repo.get(sourceId)?.pauseGaps).toEqual([
      { atSec: 2, wallSeconds: 3, reason: "interrupted" },
    ]);
  });
});

describe("tạm dừng / tiếp tục", () => {
  it("pause đóng phân đoạn, ghi khoảng ngừng khi resume; thời lượng không tính tạm dừng", async () => {
    const { sessionId, sourceId } = await startSession(h);
    feed(h, sessionId, 4);
    const paused = await h.svc.pause(OWNER, { sessionId, reason: "user" });
    expect(paused.phase).toBe("paused");
    expect(h.writers[0].closed).toBe(true);
    h.clock.now += 120_000;
    const resumed = await h.svc.resume(OWNER, { sessionId });
    expect(resumed.phase).toBe("recording");
    feed(h, sessionId, 2, 4);
    await h.svc.whenIdle();
    const s = h.repo.get(sourceId)!;
    expect(s.pauseGaps).toEqual([
      { atSec: 4, wallSeconds: 120, reason: "user" },
    ]);
    expect(s.segments.map((x) => x.index)).toEqual([0, 1]);
    expect(h.svc.status()?.durationSec).toBe(6);
  });

  it("lô audio khi đang tạm dừng bị bỏ", async () => {
    const { sessionId } = await startSession(h);
    feed(h, sessionId, 1);
    await h.svc.pause(OWNER, { sessionId, reason: "user" });
    feed(h, sessionId, 2, 1);
    expect(h.writers[0].bytes).toBe(SEC);
  });

  it("cửa sổ khác không điều khiển được phiên ⇒ meetingNotFound", async () => {
    const { sessionId } = await startSession(h);
    await expect(
      h.svc.pause(99, { sessionId, reason: "user" }),
    ).rejects.toThrow(/meetingNotFound/);
    await expect(h.svc.stop(99, { sessionId })).rejects.toThrow(
      /meetingNotFound/,
    );
  });
});

describe("kết thúc + hoàn tất (ASR chốt từng phân đoạn)", () => {
  it("stop ⇒ chốt từng phân đoạn có chồng lấn 5 s ⇒ spans + ingestParsed ⇒ done, xoá phân đoạn", async () => {
    const short = harness({ segmentSeconds: 5 });
    const { sessionId, sourceId } = await startSession(short);
    feed(short, sessionId, 8);
    const r = await short.svc.stop(OWNER, { sessionId });
    expect(r).toEqual({ sourceId });
    await short.idle();
    expect(
      short.asrCalls.map((c) => [
        c.segmentPath.split("/").pop(),
        c.prevSegmentPath?.split("/").pop(),
        c.overlapSec,
        c.language,
      ]),
    ).toEqual([
      ["seg-0000.wav", undefined, 0, "vi"],
      ["seg-0001.wav", "seg-0000.wav", 5, "vi"],
    ]);
    const s = short.repo.get(sourceId)!;
    expect(s).toMatchObject({
      phase: "done",
      endedByUser: true,
      transcriptQuality: "final",
      finalProgress: 2,
    });
    // Câu phân đoạn 1 ở tStart tương đối 1 ⇒ tuyệt đối 5 + 1 = 6.
    expect(short.repo.listSpans(sourceId).map((x) => x.tStart)).toEqual([1, 6]);
    expect(short.ingested).toHaveLength(1);
    expect(short.ingested[0].text).toBe(
      "câu của seg-0000.wav\ncâu của seg-0001.wav",
    );
    expect(short.merged).toEqual([sessionId]);
    expect(short.deletedSegments).toEqual([sessionId]);
    expect(short.notified).toEqual([sourceId]);
    expect(short.progress.at(-1)).toBeGreaterThan(0);
    expect(short.svc.status()).toBeNull();
  });

  it("phân đoạn đã chốt (checkpoint final/seg-N.json) được bỏ qua khi chạy lại", async () => {
    const short = harness({ segmentSeconds: 5 });
    const { sessionId } = await startSession(short);
    feed(short, sessionId, 8);
    short.files.set(
      sessionId,
      new Map([[0, [{ text: "đã chốt", tStart: 0, tEnd: 1 }]]]),
    );
    await short.svc.stop(OWNER, { sessionId });
    await short.idle();
    expect(short.asrCalls.map((c) => c.segmentPath.split("/").pop())).toEqual([
      "seg-0001.wav",
    ]);
  });

  it("ASR lỗi (chưa có nháp ở PR A) ⇒ incomplete: nguồn nghe được (ghép audio), 0 chunk", async () => {
    h.setAsr(async () => {
      throw new AsrError("modelMissing");
    });
    const { sessionId, sourceId } = await startSession(h);
    feed(h, sessionId, 3);
    await h.svc.stop(OWNER, { sessionId });
    await h.idle();
    expect(h.repo.get(sourceId)).toMatchObject({
      phase: "incomplete",
      transcriptQuality: null,
    });
    expect(h.merged).toEqual([sessionId]);
    expect(h.ingested[0].text).toBe("");
  });

  it("ngôn ngữ bản chốt: auto/multi ⇒ null", async () => {
    await h.svc.prepare(OWNER, { notebookId: "nb1" });
    const { sessionId } = await h.svc.start(OWNER, {
      notebookId: "nb1",
      title: "x",
      languageMode: "auto",
    });
    feed(h, sessionId, 2);
    await h.svc.stop(OWNER, { sessionId });
    await h.idle();
    expect(h.asrCalls[0].language).toBeNull();
  });
});

describe("giám sát & sự cố (PR A: tự kết thúc + hoàn tất)", () => {
  it("không nhận lô > 5 s khi đang ghi ⇒ đóng phiên, hoàn tất, endedByUser=false", async () => {
    const { sessionId, sourceId } = await startSession(h);
    feed(h, sessionId, 2);
    h.clock.now += 6000;
    h.tick();
    await h.idle();
    expect(h.repo.get(sourceId)).toMatchObject({
      phase: "done",
      endedByUser: false,
    });
    expect(h.svc.status()).toBeNull();
  });

  it("đang tạm dừng thì không bị coi là mất audio", async () => {
    const { sessionId, sourceId } = await startSession(h);
    feed(h, sessionId, 2);
    await h.svc.pause(OWNER, { sessionId, reason: "user" });
    h.clock.now += 60_000;
    h.tick();
    expect(h.repo.get(sourceId)?.phase).toBe("paused");
  });

  it("renderer của owner chết ⇒ đóng phiên + hoàn tất; renderer khác chết ⇒ không ảnh hưởng", async () => {
    const { sessionId, sourceId } = await startSession(h);
    feed(h, sessionId, 2);
    h.svc.onRendererGone(99);
    expect(h.svc.status()).not.toBeNull();
    h.svc.onRendererGone(OWNER);
    await h.idle();
    expect(h.repo.get(sourceId)?.phase).toBe("done");
  });

  it("recoverOnStartup: sửa header phân đoạn mở rồi tự hoàn tất mọi phiên dang dở", async () => {
    const { sessionId, sourceId } = await startSession(h);
    feed(h, sessionId, 2);
    await h.svc.whenIdle();
    // Mô phỏng sập: service mới trên cùng DB (phiên vẫn 'recording' như trước khi tắt).
    const svc2 = h.recreate();
    await svc2.recoverOnStartup();
    await svc2.whenIdle();
    const s = h.repo.get(sourceId)!;
    expect(s.phase).toBe("done");
    expect(s.endedByUser).toBe(false);
    expect(s.segments.every((x) => x.closed)).toBe(true);
  });
});

describe("đổi tên / xoá / notebook", () => {
  it("rename chỉ cho nguồn meeting, cắt khoảng trắng, 1–200 ký tự", async () => {
    const { sourceId } = await startSession(h);
    await h.svc.rename({ sourceId, title: "  Họp dự án  " });
    expect(h.sources.get(sourceId)?.title).toBe("Họp dự án");
    expect(h.svc.status()?.title).toBe("Họp dự án");
    await expect(h.svc.rename({ sourceId, title: "" })).rejects.toThrow(
      /meetingInvalidInput/,
    );
    await expect(
      h.svc.rename({ sourceId: "khong-co", title: "x" }),
    ).rejects.toThrow(/meetingNotFound/);
  });

  it("isRecordingNotebook đúng trong lúc ghi", async () => {
    expect(h.svc.isRecordingNotebook("nb1")).toBe(false);
    await startSession(h);
    expect(h.svc.isRecordingNotebook("nb1")).toBe(true);
  });

  it("xoá nguồn đang ghi ⇒ dừng phiên, xoá thư mục, không hoàn tất", async () => {
    const { sessionId, sourceId } = await startSession(h);
    feed(h, sessionId, 2);
    await h.svc.onSourceRemoved(sourceId);
    await h.idle();
    expect(h.svc.status()).toBeNull();
    expect(h.deletedSessions).toEqual([sessionId]);
    expect(h.asrCalls).toEqual([]);
  });

  it("xoá nguồn đang hoàn tất ⇒ dừng sau phân đoạn hiện tại, không ingest", async () => {
    const short = harness({ segmentSeconds: 5 });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    short.setAsr(async () => {
      await gate;
      return [{ text: "x", tStart: 0, tEnd: 1 }];
    });
    const { sessionId, sourceId } = await startSession(short);
    feed(short, sessionId, 8);
    await short.svc.stop(OWNER, { sessionId });
    await short.svc.onSourceRemoved(sourceId);
    release();
    await short.idle();
    expect(short.ingested).toEqual([]);
    expect(short.deletedSessions).toEqual([sessionId]);
  });
});
