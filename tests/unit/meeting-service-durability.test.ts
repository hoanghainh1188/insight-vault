import { describe, it, expect, beforeEach } from "vitest";
import { AsrError } from "../../src/main/services/meeting-capture/meeting-service";
import {
  OWNER,
  feed,
  feedSpeech,
  flush,
  harness,
  startSession,
  type Harness,
} from "./helpers/meeting-harness";

// 186 PR C1 (T107, US5/US6) — độ bền: phiên gián đoạn ⇒ thẻ phục hồi, recover/finalizeAgain, checkpoint, giữ máy thức, đua.

let h: Harness;
beforeEach(() => {
  h = harness();
});

describe("PR C1 — phục hồi phiên dang dở (US5)", () => {
  async function interrupted(): Promise<{
    sessionId: string;
    sourceId: string;
  }> {
    const r = await startSession(h);
    feedSpeech(h, r.sessionId, 12);
    await flush();
    h.svc.onRendererGone(OWNER);
    await h.idle();
    return r;
  }

  it("listRecoverable: phiên gián đoạn theo notebook (không notebookId ⇒ mọi notebook)", async () => {
    const { sessionId, sourceId } = await interrupted();
    expect(h.svc.listRecoverable({})).toEqual([
      {
        sessionId,
        sourceId,
        notebookId: "nb1",
        title: "Cuộc họp 12/10, 14:30",
        durationSec: 12,
        startedAt: expect.any(Number),
      },
    ]);
    expect(h.svc.listRecoverable({ notebookId: "khác" })).toEqual([]);
  });

  it("recover finalize ⇒ hoàn tất như thường", async () => {
    const { sessionId, sourceId } = await interrupted();
    await h.svc.recover({ sessionId, action: "finalize" });
    await h.idle();
    expect(h.repo.get(sourceId)).toMatchObject({
      phase: "done",
      transcriptQuality: "final",
    });
    expect(h.recoverablePushes.at(-1)).toBe(0);
  });

  it("recover keepIncomplete ⇒ incomplete, nghe được (ghép audio), 0 chunk", async () => {
    const { sessionId, sourceId } = await interrupted();
    await h.svc.recover({ sessionId, action: "keepIncomplete" });
    await h.idle();
    expect(h.repo.get(sourceId)?.phase).toBe("incomplete");
    expect(h.merged).toEqual([sessionId]);
    expect(h.ingested.at(-1)?.text).toBe("");
    expect(h.asrCalls).toEqual([]);
  });

  it("recover discard ⇒ xoá nguồn + thư mục phiên", async () => {
    const { sessionId, sourceId } = await interrupted();
    await h.svc.recover({ sessionId, action: "discard" });
    await h.idle();
    expect(h.removedSources).toEqual([sourceId]);
    expect(h.deletedSessions).toContain(sessionId);
    expect(h.svc.listRecoverable({})).toEqual([]);
  });

  it("recover: hành động lạ / phiên không gián đoạn ⇒ lỗi", async () => {
    const { sessionId } = await interrupted();
    await expect(
      h.svc.recover({ sessionId, action: "explode" }),
    ).rejects.toThrow("meetingInvalidInput");
    await expect(
      h.svc.recover({ sessionId: "khác", action: "finalize" }),
    ).rejects.toThrow("meetingNotFound");
    await h.svc.recover({ sessionId, action: "finalize" });
    await expect(
      h.svc.recover({ sessionId, action: "finalize" }),
    ).rejects.toThrow("meetingNotFound");
  });

  it("finalizeAgain: nguồn incomplete ⇒ chốt lại thành done; nguồn đã chốt ⇒ lỗi", async () => {
    h.setAsr(async () => {
      throw new AsrError("modelMissing");
    });
    const { sessionId, sourceId } = await startSession(h);
    feed(h, sessionId, 3);
    await h.svc.stop(OWNER, { sessionId });
    await h.idle();
    expect(h.repo.get(sourceId)?.phase).toBe("incomplete");
    h.setAsr(async () => [{ text: "chốt", tStart: 0, tEnd: 1 }]);
    await h.svc.finalizeAgain({ sourceId });
    await h.idle();
    expect(h.repo.get(sourceId)).toMatchObject({
      phase: "done",
      transcriptQuality: "final",
    });
    await expect(h.svc.finalizeAgain({ sourceId })).rejects.toThrow(
      "meetingInvalidInput",
    );
    await expect(h.svc.finalizeAgain({ sourceId: "khác" })).rejects.toThrow(
      "meetingNotFound",
    );
  });

  it("finalizeAgain: nguồn dùng transcript nháp ⇒ 'Chốt lại' thành bản chốt", async () => {
    h.setAsr(async () => {
      throw new AsrError("modelMissing");
    });
    const { sessionId, sourceId } = await startSession(h);
    feedSpeech(h, sessionId, 12);
    await flush();
    await h.svc.stop(OWNER, { sessionId });
    await h.idle();
    expect(h.repo.get(sourceId)?.transcriptQuality).toBe("draft");
    h.setAsr(async () => [{ text: "chốt", tStart: 0, tEnd: 1 }]);
    await h.svc.finalizeAgain({ sourceId });
    await h.idle();
    expect(h.repo.get(sourceId)?.transcriptQuality).toBe("final");
    expect(h.ingested.at(-1)?.text).toContain("chốt");
  });

  it("checkpoint session.json ghi khi lưu trạng thái; recoverOnStartup dùng phân đoạn từ checkpoint nếu DB cũ hơn", async () => {
    const short = harness({ segmentSeconds: 5 });
    const { sessionId, sourceId } = await startSession(short);
    feed(short, sessionId, 7); // xoay sang phân đoạn 1
    await short.idle();
    const cp = short.checkpoints.get(sessionId) as { segments: unknown[] };
    expect(cp.segments).toHaveLength(2);
    // DB cũ (mất lần lưu cuối) ⇒ checkpoint phủ.
    short.repo.update(sourceId, { segments: [] });
    const svc2 = short.recreate();
    await svc2.recoverOnStartup();
    expect(short.repo.get(sourceId)?.segments).toHaveLength(2);
  });

  it("giữ máy không ngủ khi đang ghi, thả khi kết thúc", async () => {
    const { sessionId } = await startSession(h);
    expect(h.awake).toEqual([true]);
    await h.svc.stop(OWNER, { sessionId });
    expect(h.awake).toEqual([true, false]);
  });
});

describe("review PR C1 — đua và chạy lại", () => {
  async function interrupted(): Promise<{
    sessionId: string;
    sourceId: string;
  }> {
    const r = await startSession(h);
    feed(h, r.sessionId, 4);
    h.svc.onRendererGone(OWNER);
    await h.idle();
    return r;
  }

  it("B2: hai lệnh recover song song cho cùng phiên ⇒ chỉ một chạy, lệnh kia bị từ chối", async () => {
    const { sessionId, sourceId } = await interrupted();
    const a = h.svc.recover({ sessionId, action: "keepIncomplete" });
    const b = h.svc.recover({ sessionId, action: "discard" });
    await expect(b).rejects.toThrow("meetingNotFound");
    await a;
    await h.idle();
    expect(h.removedSources).toEqual([]);
    expect(h.repo.get(sourceId)?.phase).toBe("incomplete");
    expect(h.merged).toEqual([sessionId]);
  });

  it("B1: giữ chưa hoàn thiện mà lập nguồn lỗi ⇒ vẫn interrupted (thẻ phục hồi còn), báo lỗi", async () => {
    const { sessionId, sourceId } = await interrupted();
    h.setIngestOk(false);
    await expect(
      h.svc.recover({ sessionId, action: "keepIncomplete" }),
    ).rejects.toThrow("meetingRecoverFailed");
    expect(h.repo.get(sourceId)?.phase).toBe("interrupted");
    expect(h.svc.listRecoverable({})).toHaveLength(1);
  });

  it("recoverOnStartup chạy hai lần liên tiếp ⇒ vẫn interrupted, không hoàn tất, không nhân đôi", async () => {
    const { sourceId } = await interrupted();
    const s2 = h.recreate();
    await s2.recoverOnStartup();
    const s3 = h.recreate();
    await s3.recoverOnStartup();
    await s3.whenIdle();
    expect(h.repo.get(sourceId)?.phase).toBe("interrupted");
    expect(h.asrCalls).toEqual([]);
    expect(h.recoverablePushes.at(-1)).toBe(1);
  });

  it("finalizeAgain khi nguồn đang hoàn tất ⇒ meetingInvalidInput", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    h.setAsr(async () => {
      await gate;
      return [{ text: "x", tStart: 0, tEnd: 1 }];
    });
    const { sessionId, sourceId } = await startSession(h);
    feed(h, sessionId, 3);
    await h.svc.stop(OWNER, { sessionId });
    await expect(h.svc.finalizeAgain({ sourceId })).rejects.toThrow(
      "meetingInvalidInput",
    );
    release();
    await h.idle();
  });

  it("Chốt lại nguồn nháp thất bại lần nữa ⇒ vẫn là transcript nháp (không mất nháp)", async () => {
    h.setAsr(async () => {
      throw new AsrError("modelMissing");
    });
    const { sessionId, sourceId } = await startSession(h);
    feedSpeech(h, sessionId, 12);
    await flush();
    await h.svc.stop(OWNER, { sessionId });
    await h.idle();
    await h.svc.finalizeAgain({ sourceId });
    await h.idle();
    expect(h.repo.get(sourceId)).toMatchObject({
      phase: "done",
      transcriptQuality: "draft",
    });
  });
});
