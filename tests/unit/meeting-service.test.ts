import { describe, it, expect, beforeEach } from "vitest";
import { AsrError } from "../../src/main/services/meeting-capture/meeting-service";
import type { CaptureSegment } from "../../src/main/services/meeting-capture/segments";
import {
  OWNER,
  RATE,
  SEC,
  feed,
  feedSpeech,
  flush,
  harness,
  startSession,
  type Harness,
} from "./helpers/meeting-harness";

// 186 — điều phối phiên ghi (research R4, R8, R12; data-model §5). Mọi I/O (tệp, ASR, đĩa, cửa sổ) là fake tiêm vào.

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
    const segs = short.repo.get(sourceId)?.segments as CaptureSegment[];
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

  // ADR spike S2: transformers.js không tự phát hiện ngôn ngữ (mặc định tiếng Anh) ⇒ auto phải phát hiện trước bản chốt.
  async function autoSession(segs = 2) {
    await h.svc.prepare(OWNER, { notebookId: "nb1" });
    const r = await h.svc.start(OWNER, {
      notebookId: "nb1",
      title: "x",
      languageMode: "auto",
    });
    feed(h, r.sessionId, segs);
    return r;
  }

  it("auto ⇒ phát hiện MỘT lần trên phân đoạn đầu có audio, lưu vào phiên, mọi lượt chốt dùng nó", async () => {
    const { sessionId, sourceId } = await autoSession(2);
    await h.svc.stop(OWNER, { sessionId });
    await h.idle();
    expect(h.detectCalls).toHaveLength(1);
    expect(h.detectCalls[0]).toMatch(/seg-0000\.wav$/);
    expect(h.asrCalls.length).toBeGreaterThan(0);
    expect(h.asrCalls.every((c) => c.language === "en")).toBe(true);
    expect(h.repo.get(sourceId)?.language).toBe("en");
  });

  it("chế độ khoá ngôn ngữ ⇒ không phát hiện", async () => {
    const { sessionId } = await startSession(h);
    feed(h, sessionId, 2);
    await h.svc.stop(OWNER, { sessionId });
    await h.idle();
    expect(h.detectCalls).toEqual([]);
    expect(h.asrCalls[0].language).toBe("vi");
  });

  it("phát hiện lỗi ⇒ vẫn hoàn tất, bản chốt không có ngôn ngữ (null), không lưu", async () => {
    h.setDetect(async () => {
      throw new AsrError("asrFailed");
    });
    const { sessionId, sourceId } = await autoSession(2);
    await h.svc.stop(OWNER, { sessionId });
    await h.idle();
    expect(h.asrCalls[0].language).toBeNull();
    expect(h.repo.get(sourceId)).toMatchObject({
      phase: "done",
      language: null,
    });
  });

  it("phiên đã có ngôn ngữ (chạy lại hoàn tất) ⇒ không phát hiện lại", async () => {
    const { sessionId, sourceId } = await autoSession(2);
    h.repo.update(sourceId, { language: "vi" });
    await h.svc.stop(OWNER, { sessionId });
    await h.idle();
    expect(h.detectCalls).toEqual([]);
    expect(h.asrCalls[0].language).toBe("vi");
  });
});

describe("giám sát & sự cố (PR A: tự kết thúc + hoàn tất)", () => {
  it("PR C1: không nhận lô > 5 s khi đang ghi ⇒ đóng phiên ⇒ interrupted (thẻ phục hồi), KHÔNG tự hoàn tất", async () => {
    const { sessionId, sourceId } = await startSession(h);
    feed(h, sessionId, 2);
    h.clock.now += 6000;
    h.tick();
    await h.idle();
    expect(h.repo.get(sourceId)).toMatchObject({
      phase: "interrupted",
      endedByUser: false,
    });
    expect(h.asrCalls).toEqual([]);
    expect(h.svc.status()).toBeNull();
    expect(h.recoverablePushes.at(-1)).toBe(1);
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
    expect(h.repo.get(sourceId)?.phase).toBe("interrupted");
  });

  it("PR C1 recoverOnStartup: phiên sập khi đang ghi ⇒ sửa header, interrupted + thẻ phục hồi (không tự hoàn tất)", async () => {
    const { sessionId, sourceId } = await startSession(h);
    feed(h, sessionId, 2);
    await h.svc.whenIdle();
    // Mô phỏng sập: service mới trên cùng DB (phiên vẫn 'recording' như trước khi tắt).
    const svc2 = h.recreate();
    await svc2.recoverOnStartup();
    await svc2.whenIdle();
    const s = h.repo.get(sourceId)!;
    expect(s.phase).toBe("interrupted");
    expect(s.endedByUser).toBe(false);
    expect(s.segments.every((x) => x.closed)).toBe(true);
    expect(h.asrCalls).toEqual([]);
    expect(h.recoverablePushes.at(-1)).toBe(1);
  });

  it("PR C1 recoverOnStartup: người dùng đã kết thúc (thoát có xác nhận) ⇒ tự hoàn tất", async () => {
    const { sessionId, sourceId } = await startSession(h);
    feed(h, sessionId, 2);
    h.setIngestOk(false); // hoàn tất dừng giữa chừng (app thoát) ⇒ phase giữ finalizing
    await h.svc.stopForQuit();
    await h.idle();
    expect(h.repo.get(sourceId)?.phase).toBe("finalizing");
    h.setIngestOk(true);
    const svc2 = h.recreate();
    await svc2.recoverOnStartup();
    await svc2.whenIdle();
    expect(h.repo.get(sourceId)).toMatchObject({
      phase: "done",
      endedByUser: true,
    });
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
    // M2: xoá ngay khi người dùng xoá + xoá lần cuối sau khi bước hoàn tất dừng.
    expect(short.deletedSessions.length).toBeGreaterThanOrEqual(1);
    expect(new Set(short.deletedSessions)).toEqual(new Set([sessionId]));
  });
});

describe("review PR A — main tự kết thúc phải báo renderer (B1)", () => {
  it("đĩa sắp đầy (< 1 phút) ⇒ tự kết thúc, push phase finalizing + endReason diskFull", async () => {
    const { sessionId, sourceId } = await startSession(h);
    h.setFree(500 * 1024 * 1024 + 10_000); // dưới 1 phút sau dự phòng
    feed(h, sessionId, 31); // vượt chu kỳ kiểm đĩa 30 s
    await h.idle();
    expect(h.svc.status()).toBeNull();
    expect(h.pushes.at(-1)).toMatchObject({
      sourceId,
      phase: "finalizing",
      endReason: "diskFull",
    });
    expect(h.repo.get(sourceId)).toMatchObject({
      phase: "done",
      endedByUser: true,
    });
  });

  it("không nhận lô > 5 s ⇒ push phase interrupted + endReason noAudio", async () => {
    const { sessionId } = await startSession(h);
    feed(h, sessionId, 2);
    h.clock.now += 20_000; // quá cả ân hạn khởi đầu
    h.tick();
    await h.idle();
    expect(h.pushes.at(-1)).toMatchObject({
      phase: "interrupted",
      endReason: "noAudio",
    });
  });

  it("lỗi ghi tệp ⇒ đóng phiên an toàn, push endReason crash", async () => {
    const { sessionId, sourceId } = await startSession(h);
    feed(h, sessionId, 2);
    h.failWriter();
    await h.idle();
    expect(h.svc.status()).toBeNull();
    expect(h.pushes.at(-1)).toMatchObject({
      phase: "interrupted",
      endReason: "crash",
    });
    expect(h.repo.get(sourceId)?.endedByUser).toBe(false);
  });
});

describe("review PR A — hoàn tất bền khi lập chỉ mục chưa xong (B2)", () => {
  it("ingestParsed chưa thành công ⇒ phase giữ finalizing; khởi động lại thì hoàn tất tiếp", async () => {
    h.setIngestOk(false);
    const { sessionId, sourceId } = await startSession(h);
    feed(h, sessionId, 3);
    await h.svc.stop(OWNER, { sessionId });
    await h.idle();
    expect(h.repo.get(sourceId)?.phase).toBe("finalizing");
    expect(h.deletedSegments).toEqual([]);
    h.setIngestOk(true);
    const svc2 = h.recreate();
    await svc2.recoverOnStartup();
    await svc2.whenIdle();
    expect(h.repo.get(sourceId)).toMatchObject({
      phase: "done",
      transcriptQuality: "final",
    });
    expect(h.deletedSegments).toEqual([sessionId]);
  });
});

describe("review PR A — tiếp tục ghi có ân hạn (B3)", () => {
  it("sau resume chưa có lô trong 6 s vẫn còn ghi; quá ân hạn 15 s mới bị coi là mất audio", async () => {
    const { sessionId } = await startSession(h);
    feed(h, sessionId, 1);
    await h.svc.pause(OWNER, { sessionId, reason: "user" });
    await h.svc.resume(OWNER, { sessionId });
    h.clock.now += 6_000;
    h.tick();
    expect(h.svc.status()?.phase).toBe("recording");
    h.clock.now += 10_000;
    h.tick();
    await h.idle();
    expect(h.svc.status()).toBeNull();
  });
});

describe("review PR A — start đồng thời (B4)", () => {
  it("hai lệnh start song song ⇒ chỉ một phiên, lệnh còn lại meetingAlreadyRecording", async () => {
    await h.svc.prepare(OWNER, { notebookId: "nb1" });
    const input = { notebookId: "nb1", title: "x", languageMode: "auto" };
    const r = await Promise.allSettled([
      h.svc.start(OWNER, input),
      h.svc.start(OWNER, input),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const rejected = r.find(
      (x) => x.status === "rejected",
    ) as PromiseRejectedResult;
    expect(String(rejected.reason)).toMatch(/meetingAlreadyRecording/);
    expect(h.sources.size).toBe(1);
  });
});

describe("review PR A — cổng micro (M1)", () => {
  it("prepare mở cổng chỉ khi chưa có phiên và notebook tồn tại", async () => {
    await h.svc.prepare(OWNER, { notebookId: "khong-co" });
    expect(h.gate.armedUntil()).toBe(0);
    await h.svc.prepare(OWNER, { notebookId: "nb1" });
    expect(h.gate.armedUntil()).toBeGreaterThan(0);
    await h.svc.start(OWNER, {
      notebookId: "nb1",
      title: "x",
      languageMode: "auto",
    });
    expect(h.gate.armedUntil()).toBe(0);
    await h.svc.prepare(OWNER, { notebookId: "nb1" });
    expect(h.gate.armedUntil()).toBe(0);
  });
});

describe("review PR A — xoá khi đang hoàn tất không để tệp mồ côi (M2)", () => {
  it("xoá trong lúc ASR chạy ⇒ sau khi hoàn tất dừng, thư mục phiên bị xoá lại lần cuối", async () => {
    let release!: () => void;
    const gateAsr = new Promise<void>((r) => (release = r));
    h.setAsr(async () => {
      await gateAsr;
      return [{ text: "x", tStart: 0, tEnd: 1 }];
    });
    const { sessionId, sourceId } = await startSession(h);
    feed(h, sessionId, 3);
    await h.svc.stop(OWNER, { sessionId });
    // PR B: hoàn tất chạy sau khi xả nháp ⇒ chờ tới lúc ASR chốt thật sự đang chạy rồi mới xoá.
    for (let i = 0; i < 20 && h.asrCalls.length === 0; i++) await flush();
    expect(h.asrCalls).toHaveLength(1);
    await h.svc.onSourceRemoved(sourceId);
    release();
    await h.idle();
    expect(h.deletedSessions.length).toBeGreaterThanOrEqual(2);
    expect(h.deletedSessions.every((x) => x === sessionId)).toBe(true);
    expect(h.merged).toEqual([]);
  });
});

describe("review PR A — khoảng mất lô liền kề được gộp (M3)", () => {
  it("hai lần nhảy seq ở cùng vị trí thời gian ⇒ một khoảng ngừng", async () => {
    const { sessionId, sourceId } = await startSession(h);
    feed(h, sessionId, 1);
    h.clock.now += 1000;
    h.svc.acceptAudio(OWNER, { sessionId, seq: 3, pcm: new ArrayBuffer(0) }); // lô rỗng bị bỏ
    h.svc.acceptAudio(OWNER, { sessionId, seq: 3, pcm: new ArrayBuffer(SEC) });
    h.clock.now += 1000;
    await h.idle();
    expect(h.repo.get(sourceId)?.pauseGaps).toEqual([
      { atSec: 1, wallSeconds: 2, reason: "interrupted" },
    ]);
  });
});

describe("review PR A — ASR lỗi không báo 'sẵn sàng' (S3)", () => {
  it("chưa có transcript ⇒ không notifyReady", async () => {
    h.setAsr(async () => {
      throw new AsrError("asrFailed");
    });
    const { sessionId, sourceId } = await startSession(h);
    feed(h, sessionId, 2);
    await h.svc.stop(OWNER, { sessionId });
    await h.idle();
    expect(h.repo.get(sourceId)?.phase).toBe("incomplete");
    expect(h.notified).toEqual([]);
  });
});

describe("PR B — nháp khi đang ghi", () => {
  it("10 s có lời ⇒ nháp với ngôn ngữ đã khoá, push meeting:draft chỉ tới owner, ghi draft.jsonl", async () => {
    const { sessionId } = await startSession(h);
    feedSpeech(h, sessionId, 10);
    await flush();
    // Lượt 5 s ("Đang nhận dạng") rồi lượt đủ 10 s cùng id.
    expect(h.draftCalls).toEqual([
      { language: "vi", tier: "primary", bytes: 5 * SEC },
      { language: "vi", tier: "primary", bytes: 10 * SEC },
    ]);
    expect(h.draftPushes.map((p) => p.id)).toEqual([OWNER, OWNER]);
    expect(h.draftPushes.at(-1)).toEqual({
      id: OWNER,
      ev: {
        sessionId,
        full: false,
        windows: [
          { id: "w0", tStart: 0, tEnd: 10, text: "nháp", pending: false },
        ],
      },
    });
    expect(h.drafts.get(sessionId)).toHaveLength(1);
  });

  it("im lặng ⇒ không nháp", async () => {
    const { sessionId } = await startSession(h);
    feed(h, sessionId, 20);
    await flush();
    expect(h.draftCalls).toEqual([]);
  });

  it("tạm dừng ⇒ phần dở của cửa sổ được nháp ngay", async () => {
    const { sessionId } = await startSession(h);
    feedSpeech(h, sessionId, 4);
    await h.svc.pause(OWNER, { sessionId });
    await flush();
    expect(h.draftCalls).toHaveLength(1);
    expect(h.draftCalls[0]?.bytes).toBe(4 * SEC);
  });

  it("thiếu model ⇒ vẫn ghi, modelReady=false; tải model ⇒ nháp chạy lại", async () => {
    h.setDraft(async () => {
      throw new AsrError("modelMissing");
    });
    const { sessionId } = await startSession(h);
    let seq = feedSpeech(h, sessionId, 10);
    await flush();
    expect(h.pushes.at(-1)?.modelReady).toBe(false);
    seq = feedSpeech(h, sessionId, 10, seq);
    await flush();
    const before = h.draftCalls.length; // chỉ lượt đầu (bị thiếu model), sau đó ngừng nháp
    expect(before).toBe(1);
    expect(h.writers[0]?.bytes).toBe(20 * SEC);
    h.setDraft(async () => ({ segments: [], language: null, elapsedMs: 1 }));
    const st = await h.svc.downloadModel();
    expect(st).toEqual({ ok: true });
    expect(h.downloads).toHaveLength(1);
    expect(h.svc.status()?.modelReady).toBe(true);
    feedSpeech(h, sessionId, 10, seq);
    await flush();
    expect(h.draftCalls.length).toBeGreaterThan(before);
  });

  it("resendDrafts ⇒ push danh sách đầy đủ (renderer gắn lại sau reload)", async () => {
    const { sessionId } = await startSession(h);
    feedSpeech(h, sessionId, 10);
    await flush();
    h.svc.resendDrafts();
    expect(h.draftPushes.at(-1)?.ev).toMatchObject({ full: true, sessionId });
    expect(h.draftPushes.at(-1)?.ev.windows).toHaveLength(1);
  });
});

describe("PR B — ngôn ngữ (R7)", () => {
  it("chế độ khoá ⇒ trạng thái manual, không phát hiện", async () => {
    const { sessionId } = await startSession(h, "x", "en");
    feedSpeech(h, sessionId, 40);
    await flush();
    expect(h.detectPcmCalls).toEqual([]);
    expect(h.svc.status()?.language).toEqual({
      mode: "en",
      current: "en",
      status: "manual",
    });
  });

  it("auto ⇒ 'đang nhận dạng', đủ 30 s lời nói ⇒ phát hiện, khoá, lưu phiên", async () => {
    const { sessionId, sourceId } = await startSession(h, "x", "auto");
    expect(h.svc.status()?.language).toMatchObject({
      status: "detecting",
      current: null,
    });
    feedSpeech(h, sessionId, 30);
    await flush();
    expect(h.detectPcmCalls).toEqual([30 * SEC]);
    expect(h.svc.status()?.language).toEqual({
      mode: "auto",
      current: "vi",
      status: "locked",
    });
    expect(h.repo.get(sourceId)).toMatchObject({
      language: "vi",
      languageChanges: [{ atSec: 0, lang: "vi", source: "auto" }],
    });
    expect(h.draftCalls[0]?.language).toBe("perWindow");
  });

  it("phát hiện ngôn ngữ khác hai lần liên tiếp ⇒ gợi ý; chấp nhận ⇒ đổi từ thời điểm hiện tại", async () => {
    const { sessionId, sourceId } = await startSession(h, "x", "auto");
    let seq = feedSpeech(h, sessionId, 30);
    await flush();
    h.setDetectPcm(async () => ({ language: "en", confidence: 0.9 }));
    for (let i = 0; i < 25; i++) {
      seq = feedSpeech(h, sessionId, 10, seq);
      await flush();
    }
    expect(h.svc.status()?.language.suggestion).toBe("en");
    const st = await h.svc.setLanguage(OWNER, {
      sessionId,
      action: "acceptSuggestion",
    });
    expect(st.language).toMatchObject({ current: "en", status: "locked" });
    expect(st.language.suggestion).toBeUndefined();
    expect(h.repo.get(sourceId)?.languageChanges).toEqual([
      { atSec: 0, lang: "vi", source: "auto" },
      { atSec: 280, lang: "en", source: "auto" },
    ]);
  });

  it("setLanguage lock ⇒ manual; đầu vào sai / cửa sổ khác ⇒ lỗi", async () => {
    const { sessionId, sourceId } = await startSession(h, "x", "auto");
    feedSpeech(h, sessionId, 5);
    const st = await h.svc.setLanguage(OWNER, {
      sessionId,
      action: "lock",
      lang: "en",
    });
    expect(st.language).toEqual({
      mode: "en",
      current: "en",
      status: "manual",
    });
    expect(h.repo.get(sourceId)?.language).toBe("en");
    await expect(
      h.svc.setLanguage(OWNER, { sessionId, action: "lock", lang: "fr" }),
    ).rejects.toThrow("meetingInvalidInput");
    await expect(
      h.svc.setLanguage(OWNER, { sessionId, action: "explode" }),
    ).rejects.toThrow("meetingInvalidInput");
    await expect(
      h.svc.setLanguage(99, { sessionId, action: "dismissSuggestion" }),
    ).rejects.toThrow("meetingNotFound");
  });

  it("bản chốt dùng ngôn ngữ chiếm phần lớn từng phân đoạn theo lịch sử đổi", async () => {
    const short = harness({ segmentSeconds: 10 });
    const { sessionId } = await startSession(short, "x", "vi");
    const seq = feedSpeech(short, sessionId, 12);
    await short.svc.setLanguage(OWNER, {
      sessionId,
      action: "lock",
      lang: "en",
    });
    feedSpeech(short, sessionId, 18, seq);
    await short.svc.stop(OWNER, { sessionId });
    await short.idle();
    expect(short.asrCalls.map((c) => c.language)).toEqual(["vi", "en", "en"]);
  });

  it("Đa ngôn ngữ rồi khoá tay ⇒ phần trước lần khoá vẫn perWindow, phần sau theo ngôn ngữ khoá (review S3)", async () => {
    const short = harness({ segmentSeconds: 10 });
    const { sessionId } = await startSession(short, "x", "multi");
    const seq = feedSpeech(short, sessionId, 22);
    await short.svc.setLanguage(OWNER, {
      sessionId,
      action: "lock",
      lang: "en",
    });
    feedSpeech(short, sessionId, 18, seq);
    await short.svc.stop(OWNER, { sessionId });
    await short.idle();
    expect(short.asrCalls.map((c) => c.language)).toEqual([
      "perWindow",
      "perWindow",
      "en",
      "en",
    ]);
  });

  it("Đa ngôn ngữ ⇒ bản chốt phát hiện theo từng cửa sổ (perWindow)", async () => {
    const { sessionId } = await startSession(h, "x", "multi");
    feedSpeech(h, sessionId, 5);
    await h.svc.stop(OWNER, { sessionId });
    await h.idle();
    expect(h.asrCalls.map((c) => c.language)).toEqual(["perWindow"]);
    expect(h.detectCalls).toEqual([]);
  });
});

describe("PR B — đánh dấu", () => {
  it("mark hợp lệ khi đang ghi / tạm dừng; listMarkers theo nguồn", async () => {
    const { sessionId, sourceId } = await startSession(h);
    feed(h, sessionId, 20);
    const a = await h.svc.mark(OWNER, {
      sessionId,
      kind: "decision",
      tStart: 12,
    });
    await h.svc.pause(OWNER, { sessionId });
    const b = await h.svc.mark(OWNER, {
      sessionId,
      kind: "actionItem",
      tStart: 3,
      tEnd: 8,
    });
    expect(await h.svc.listMarkers({ sourceId })).toEqual([
      { id: b.markerId, kind: "actionItem", tStart: 3, tEnd: 8 },
      { id: a.markerId, kind: "decision", tStart: 12, tEnd: 12 },
    ]);
  });

  it("đầu vào sai ⇒ meetingInvalidInput; không có phiên ⇒ meetingNotFound", async () => {
    const { sessionId, sourceId } = await startSession(h);
    feed(h, sessionId, 10);
    for (const bad of [
      { sessionId, kind: "note", tStart: 1 },
      { sessionId, kind: "question", tStart: -1 },
      { sessionId, kind: "question", tStart: 5, tEnd: 4 },
      { sessionId, kind: "question", tStart: 12 }, // > thời lượng + 1
      { sessionId, kind: "question", tStart: Number.NaN },
    ]) {
      await expect(h.svc.mark(OWNER, bad)).rejects.toThrow(
        "meetingInvalidInput",
      );
    }
    await h.svc.stop(OWNER, { sessionId });
    await expect(
      h.svc.mark(OWNER, { sessionId, kind: "question", tStart: 1 }),
    ).rejects.toThrow("meetingNotFound");
    expect(await h.svc.listMarkers({ sourceId })).toEqual([]);
    await expect(h.svc.listMarkers({ sourceId: "khác" })).rejects.toThrow(
      "meetingNotFound",
    );
  });
});

describe("PR B — hoàn tất dự phòng bằng nháp", () => {
  it("ASR chốt lỗi nhưng có nháp ⇒ done + quality draft, KHÔNG lập chỉ mục nháp (FR-027), giữ phân đoạn", async () => {
    h.setAsr(async () => {
      throw new AsrError("modelMissing");
    });
    const { sessionId, sourceId } = await startSession(h);
    feedSpeech(h, sessionId, 20);
    await flush();
    await h.svc.stop(OWNER, { sessionId });
    await h.idle();
    expect(h.repo.get(sourceId)).toMatchObject({
      phase: "done",
      transcriptQuality: "draft",
    });
    expect(h.ingested[0]?.text).toBe("");
    expect(h.deletedSegments).toEqual([]);
    expect(h.drafts.get(sessionId)?.length).toBeGreaterThan(0);
    expect(h.notified).toEqual([sourceId]);
  });
});

describe("PR B — chẩn đoán hiệu năng (ADR mục 7)", () => {
  it("kết thúc phiên ⇒ một dòng meeting.perf: máy + RTF nháp, không nội dung", async () => {
    const { sessionId } = await startSession(h);
    feedSpeech(h, sessionId, 20);
    await flush();
    await h.svc.stop(OWNER, { sessionId });
    await h.idle();
    const perf = h.logs.find((l) => l.event === "meeting.perf");
    expect(perf?.meta).toEqual({
      platform: "darwin",
      arch: "arm64",
      cpu: "Test CPU",
      cores: 8,
      ramGb: 16,
      draftWindows: 2,
      draftRtfMean: 0.01,
      draftRtfP95: 0.01,
      draftDropped: 0,
      draftDowngraded: false,
      draftModel: "primary",
    });
    const fin = h.logs.find((l) => l.event === "meeting.finalPerf");
    expect(typeof fin?.meta?.["rtf"]).toBe("number");
  });
});
