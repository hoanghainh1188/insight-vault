import { describe, it, expect } from "vitest";
import {
  createAsrClient,
  type UtilityProcessLike,
} from "../../src/main/services/meeting-capture/asr-client";
import { AsrError } from "../../src/main/services/meeting-capture/meeting-service";

// 186 — client main ↔ asr-worker (R5): fork lười, khớp reqId, kiểm tin từ worker, worker chết ⇒ lỗi + fork lại có giới hạn.

class FakeChild implements UtilityProcessLike {
  sent: unknown[] = [];
  private msg: ((m: unknown) => void)[] = [];
  private exit: ((code: number) => void)[] = [];
  killed = false;
  postMessage(m: unknown): void {
    this.sent.push(m);
  }
  on(ev: "message" | "exit", cb: (x: never) => void): this {
    if (ev === "message") this.msg.push(cb as (m: unknown) => void);
    else this.exit.push(cb as (c: number) => void);
    return this;
  }
  kill(): boolean {
    this.killed = true;
    return true;
  }
  emit(m: unknown): void {
    this.msg.forEach((cb) => cb(m));
  }
  die(code = 1): void {
    this.exit.forEach((cb) => cb(code));
  }
}

function setup(now = { t: 0 }) {
  const children: FakeChild[] = [];
  const downloads: boolean[] = [];
  const client = createAsrClient({
    workerPath: "/app/out/main/asr-worker.js",
    meetingsRoot: "/data/meetings",
    cacheDir: "/data/models",
    finalModel: "Xenova/whisper-base",
    fallbackModel: "Xenova/whisper-tiny",
    fake: false,
    fork: () => {
      const c = new FakeChild();
      children.push(c);
      return c;
    },
    onModelDownload: (a) => downloads.push(a),
    now: () => now.t,
  });
  return { client, children, downloads, now };
}

const REQ = {
  segmentPath: "/data/meetings/s/seg-0000.wav",
  overlapSec: 0,
  language: "vi" as const,
};
const reqIdOf = (c: FakeChild, i = 1): string =>
  (c.sent[i] as { reqId: string }).reqId;

describe("asr-client", () => {
  it("fork lười, gửi init rồi final; trả segment khi worker báo result", async () => {
    const { client, children } = setup();
    expect(children).toHaveLength(0);
    const p = client.final(REQ);
    expect(children).toHaveLength(1);
    expect(children[0].sent[0]).toEqual({
      type: "init",
      cacheDir: "/data/models",
      finalModel: "Xenova/whisper-base",
      fallbackModel: "Xenova/whisper-tiny",
      fake: false,
    });
    expect(children[0].sent[1]).toMatchObject({ type: "final", ...REQ });
    children[0].emit({
      type: "result",
      reqId: reqIdOf(children[0]),
      segments: [{ text: "a", tStart: 0, tEnd: 1 }],
    });
    await expect(p).resolves.toEqual([{ text: "a", tStart: 0, tEnd: 1 }]);
  });

  it("lỗi từ worker ⇒ AsrError đúng mã; tin rác bị bỏ qua", async () => {
    const { client, children } = setup();
    const p = client.final(REQ);
    children[0].emit({
      type: "result",
      reqId: reqIdOf(children[0]),
      segments: "rác",
    });
    children[0].emit({
      type: "error",
      reqId: reqIdOf(children[0]),
      code: "modelMissing",
    });
    await expect(p).rejects.toEqual(new AsrError("modelMissing"));
  });

  it("modelDownload chuyển tiếp cho chỉ báo riêng tư", () => {
    const { client, children, downloads } = setup();
    void client.final(REQ).catch(() => undefined);
    children[0].emit({ type: "modelDownload", active: true });
    children[0].emit({ type: "modelDownload", active: false });
    expect(downloads).toEqual([true, false]);
  });

  it("worker chết ⇒ yêu cầu đang chờ bị từ chối asrFailed; lần sau fork lại; tắt chỉ báo tải nếu đang bật", async () => {
    const { client, children, downloads } = setup();
    const p = client.final(REQ);
    children[0].emit({ type: "modelDownload", active: true });
    children[0].die();
    await expect(p).rejects.toEqual(new AsrError("asrFailed"));
    expect(downloads.at(-1)).toBe(false);
    const p2 = client.final(REQ);
    expect(children).toHaveLength(2);
    children[1].emit({
      type: "result",
      reqId: reqIdOf(children[1]),
      segments: [],
    });
    await expect(p2).resolves.toEqual([]);
  });

  it("quá 3 lần fork lại trong 5 phút ⇒ từ chối ngay, không fork thêm", async () => {
    const { client, children, now } = setup();
    for (let i = 0; i < 4; i++) {
      const p = client.final(REQ);
      children[children.length - 1].die();
      await expect(p).rejects.toBeInstanceOf(AsrError);
      now.t += 1000;
    }
    const forks = children.length;
    await expect(client.final(REQ)).rejects.toEqual(new AsrError("asrFailed"));
    expect(children.length).toBe(forks);
    now.t += 5 * 60_000;
    void client.final(REQ).catch(() => undefined);
    expect(children.length).toBe(forks + 1);
  });

  it("dispose ⇒ kill worker, từ chối yêu cầu đang chờ", async () => {
    const { client, children } = setup();
    const p = client.final(REQ);
    client.dispose();
    expect(children[0].killed).toBe(true);
    await expect(p).rejects.toBeInstanceOf(AsrError);
  });
});

describe("asr-client — detectLanguage", () => {
  it("gửi detect, trả ngôn ngữ + độ tin cậy khi worker báo language", async () => {
    const { client, children } = setup();
    const p = client.detectLanguage({ segmentPath: REQ.segmentPath });
    expect(children[0].sent[1]).toMatchObject({
      type: "detect",
      segmentPath: REQ.segmentPath,
    });
    children[0].emit({
      type: "language",
      reqId: reqIdOf(children[0]),
      language: "en",
      confidence: 0.97,
    });
    await expect(p).resolves.toEqual({ language: "en", confidence: 0.97 });
  });

  it("worker trả result cho reqId của detect (sai loại) ⇒ bỏ qua; error ⇒ AsrError", async () => {
    const { client, children } = setup();
    const p = client.detectLanguage({ segmentPath: REQ.segmentPath });
    const id = reqIdOf(children[0]);
    children[0].emit({ type: "result", reqId: id, segments: [] });
    children[0].emit({ type: "error", reqId: id, code: "asrFailed" });
    await expect(p).rejects.toEqual(new AsrError("asrFailed"));
  });

  it("final nhận tin language (sai loại) ⇒ bỏ qua", async () => {
    const { client, children } = setup();
    const p = client.final(REQ);
    const id = reqIdOf(children[0]);
    children[0].emit({
      type: "language",
      reqId: id,
      language: "vi",
      confidence: 1,
    });
    children[0].emit({ type: "result", reqId: id, segments: [] });
    await expect(p).resolves.toEqual([]);
  });
});

describe("asr-client — nháp (PR B)", () => {
  it("draft gửi PCM + ngôn ngữ + tier; trả kết quả khi worker báo draftResult", async () => {
    const { client, children } = setup();
    const pcm = new ArrayBuffer(320_000);
    const p = client.draft({ pcm, language: "perWindow", tier: "primary" });
    const c = children[0] as FakeChild;
    const sent = c.sent.at(-1) as Record<string, unknown>;
    expect(sent).toMatchObject({ type: "draft", pcm, language: "perWindow", tier: "primary" });
    c.emit({
      type: "draftResult",
      reqId: sent["reqId"],
      segments: [{ text: "chào", tStart: 0, tEnd: 1 }],
      language: "vi",
      confidence: 0.9,
      elapsedMs: 300,
    });
    await expect(p).resolves.toEqual({
      segments: [{ text: "chào", tStart: 0, tEnd: 1 }],
      language: "vi",
      confidence: 0.9,
      elapsedMs: 300,
    });
  });

  it("detectPcm chờ tin language; draftResult cho cùng reqId bị bỏ qua", async () => {
    const { client, children } = setup();
    const p = client.detectPcm({ pcm: new ArrayBuffer(64) });
    const c = children[0] as FakeChild;
    const sent = c.sent.at(-1) as Record<string, unknown>;
    expect(sent).toMatchObject({ type: "detectPcm" });
    c.emit({ type: "draftResult", reqId: sent["reqId"], segments: [], language: null, elapsedMs: 1 });
    c.emit({ type: "language", reqId: sent["reqId"], language: "en", confidence: 0.75 });
    await expect(p).resolves.toEqual({ language: "en", confidence: 0.75 });
  });
});
