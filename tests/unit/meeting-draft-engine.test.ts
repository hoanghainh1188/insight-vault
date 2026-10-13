import { describe, it, expect, vi } from "vitest";
import type { MeetingDraftLine } from "../../src/shared/ipc/types";
import {
  createDraftEngine,
  type DraftAsrClient,
  type DraftEngineDeps,
} from "../../src/main/services/meeting-capture/draft-engine";
import { AsrError } from "../../src/main/services/meeting-capture/meeting-io";

// 186 PR B (R6, ADR spike mục 4–5) — bộ máy nháp khi đang ghi: cửa sổ 10 s liên tiếp trên trục thời gian audio, VAD bỏ im lặng,
// lượt 5 s "Đang nhận dạng", hàng việc bỏ tồn đọng, đo RTF ⇒ tự hạ cấp, phát hiện ngôn ngữ trên 30 s lời nói gần nhất.

const SR = 16_000;
const speech = (sec: number): Int16Array => {
  const a = new Int16Array(Math.round(sec * SR));
  for (let i = 0; i < a.length; i++)
    a[i] = Math.round(8000 * Math.sin((2 * Math.PI * 220 * i) / SR));
  return a;
};
const silence = (sec: number): Int16Array => new Int16Array(sec * SR);

interface Call {
  kind: "draft" | "detect";
  bytes: number;
  language?: string;
  tier?: string;
  resolve(v: unknown): void;
  reject(e: unknown): void;
}

function fakeAsr(): DraftAsrClient & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    draft: (req) =>
      new Promise((resolve, reject) =>
        calls.push({
          kind: "draft",
          bytes: req.pcm.byteLength,
          language: req.language,
          tier: req.tier,
          resolve,
          reject,
        }),
      ),
    detectPcm: (req) =>
      new Promise((resolve, reject) =>
        calls.push({
          kind: "detect",
          bytes: req.pcm.byteLength,
          resolve,
          reject,
        }),
      ),
  } as DraftAsrClient & { calls: Call[] };
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function setup(over: Partial<DraftEngineDeps> = {}) {
  const asr = fakeAsr();
  const lines: MeetingDraftLine[] = [];
  const persisted: unknown[] = [];
  const lagging: boolean[] = [];
  const detected: unknown[] = [];
  const deps: DraftEngineDeps = {
    asr,
    sampleRate: SR,
    windowSec: 10,
    partialSec: 5,
    partialPass: false,
    windowLanguage: () => "vi",
    shouldDetect: () => false,
    onLines: (l) => lines.push(...l),
    onLagging: (v) => lagging.push(v),
    onDetected: (lang, confidence, atSec) =>
      detected.push({ lang, confidence, atSec }),
    onModelMissing: vi.fn(),
    persistLine: (l) => persisted.push(l),
    log: vi.fn(),
    ...over,
  };
  const engine = createDraftEngine(deps);
  return { engine, asr, lines, persisted, lagging, detected, deps };
}

const ok = (text: string, elapsedMs = 500, language = "vi") => ({
  segments: [{ text, tStart: 0, tEnd: 1 }],
  language,
  elapsedMs,
});

describe("createDraftEngine", () => {
  it("cửa sổ 10 s có lời ⇒ một lượt nháp, dòng w0 có timestamp, ghi draft.jsonl", async () => {
    const t = setup();
    t.engine.push(speech(10));
    expect(t.asr.calls).toHaveLength(1);
    expect(t.asr.calls[0]).toMatchObject({
      kind: "draft",
      bytes: 320_000,
      language: "vi",
      tier: "primary",
    });
    t.asr.calls[0]?.resolve(ok(" Xin chào "));
    await tick();
    expect(t.lines).toEqual([
      { id: "w0", tStart: 0, tEnd: 10, text: "Xin chào", pending: false },
    ]);
    expect(t.persisted).toEqual([
      { id: "w0", tStart: 0, tEnd: 10, text: "Xin chào", lang: "vi" },
    ]);
  });

  it("nhận PCM theo lô nhỏ, cửa sổ nối liền trên trục thời gian", async () => {
    const t = setup();
    const all = speech(20);
    for (let i = 0; i < all.length; i += SR)
      t.engine.push(all.subarray(i, i + SR));
    t.asr.calls[0]?.resolve(ok("một"));
    await tick();
    t.asr.calls[1]?.resolve(ok("hai"));
    await tick();
    expect(t.lines.map((l) => [l.id, l.tStart, l.tEnd])).toEqual([
      ["w0", 0, 10],
      ["w1", 10, 20],
    ]);
  });

  it("cửa sổ im lặng ⇒ không gọi ASR, không có dòng", () => {
    const t = setup();
    t.engine.push(silence(10));
    expect(t.asr.calls).toHaveLength(0);
    expect(t.lines).toEqual([]);
  });

  it("lượt 5 s ⇒ dòng pending, rồi lượt đủ thay tại chỗ (cùng id)", async () => {
    const t = setup({ partialPass: true });
    t.engine.push(speech(5));
    expect(t.asr.calls[0]).toMatchObject({ bytes: 160_000 });
    t.asr.calls[0]?.resolve(ok("Xin"));
    await tick();
    t.engine.push(speech(5));
    t.asr.calls[1]?.resolve(ok("Xin chào"));
    await tick();
    expect(t.lines).toEqual([
      { id: "w0", tStart: 0, tEnd: 5, text: "Xin", pending: true },
      { id: "w0", tStart: 0, tEnd: 10, text: "Xin chào", pending: false },
    ]);
    expect(t.persisted).toHaveLength(1);
  });

  it("flush khi tạm dừng/kết thúc ⇒ cửa sổ ngắn cũng được nháp", async () => {
    const t = setup();
    t.engine.push(speech(4));
    t.engine.flush();
    expect(t.asr.calls[0]).toMatchObject({ bytes: 128_000 });
    t.asr.calls[0]?.resolve(ok("ngắn"));
    await tick();
    expect(t.lines[0]).toMatchObject({ id: "w0", tStart: 0, tEnd: 4 });
    t.engine.push(speech(10));
    t.asr.calls[1]?.resolve(ok("tiếp"));
    await tick();
    expect(t.lines[1]).toMatchObject({ id: "w1", tStart: 4, tEnd: 14 });
  });

  it("tồn đọng > 3 cửa sổ ⇒ bỏ cũ nhất, bật lagging; bắt kịp ⇒ tắt", async () => {
    const t = setup();
    t.engine.push(speech(60)); // w0 đang chạy, w1..w5 chờ
    expect(t.asr.calls).toHaveLength(1);
    t.asr.calls[0]?.resolve(ok("a"));
    await tick();
    expect(t.lagging).toContain(true);
    // w1, w2 bị bỏ ⇒ lượt kế tiếp là w3
    t.asr.calls[1]?.resolve(ok("b"));
    await tick();
    t.asr.calls[2]?.resolve(ok("c"));
    await tick();
    t.asr.calls[3]?.resolve(ok("d"));
    await tick();
    expect(t.lines.map((l) => l.id)).toEqual(["w0", "w3", "w4", "w5"]);
    expect(t.lagging.at(-1)).toBe(false);
  });

  it("RTF trung bình > 0,5 ⇒ chuyển nháp sang model dự phòng (tier fallback)", async () => {
    const t = setup();
    t.engine.push(speech(40));
    for (let i = 0; i < 3; i++) {
      t.asr.calls[i]?.resolve(ok("x", 7000));
      await tick();
    }
    expect(t.asr.calls[3]?.tier).toBe("fallback");
    expect(t.engine.perf().downgraded).toBe(true);
    expect(t.deps.log).toHaveBeenCalledWith("meeting.draftDowngraded", {
      rtf: 0.7,
    });
  });

  it("model dự phòng thiếu (offline) ⇒ quay về model chính, không báo thiếu model", async () => {
    const t = setup();
    t.engine.push(speech(50));
    for (let i = 0; i < 3; i++) {
      t.asr.calls[i]?.resolve(ok("x", 7000));
      await tick();
    }
    t.asr.calls[3]?.reject(new AsrError("modelMissing"));
    await tick();
    t.engine.push(speech(10));
    expect(t.asr.calls.at(-1)?.tier).toBe("primary");
    expect(t.deps.onModelMissing).not.toHaveBeenCalled();
  });

  it("model chính thiếu ⇒ onModelMissing, ngừng nháp tới khi resumeModel()", async () => {
    const t = setup();
    t.engine.push(speech(10));
    t.asr.calls[0]?.reject(new AsrError("modelMissing"));
    await tick();
    expect(t.deps.onModelMissing).toHaveBeenCalledTimes(1);
    t.engine.push(speech(10));
    expect(t.asr.calls).toHaveLength(1);
    t.engine.resumeModel();
    t.engine.push(speech(10));
    expect(t.asr.calls).toHaveLength(2);
  });

  it("đủ 30 s lời nói ⇒ phát hiện ngôn ngữ (ưu tiên trước nháp) trên ≤ 30 s gần nhất", async () => {
    const t = setup({ shouldDetect: (speechSec) => speechSec >= 30 });
    t.engine.push(speech(40)); // w0 đang chạy; đủ 30 s lời nói khi tạo w2 ⇒ xếp detect
    t.asr.calls[0]?.resolve(ok("x"));
    await tick();
    const det = t.asr.calls[1];
    expect(det).toMatchObject({ kind: "detect", bytes: 960_000 });
    det?.resolve({ language: "en", confidence: 0.8 });
    await tick();
    expect(t.detected).toEqual([{ lang: "en", confidence: 0.8, atSec: 30 }]);
    expect(t.asr.calls.filter((c) => c.kind === "detect")).toHaveLength(1);
  });

  it("cửa sổ chỉ có ảo giác (rỗng sau khử) ⇒ không có dòng", async () => {
    const t = setup();
    t.engine.push(speech(10));
    t.asr.calls[0]?.resolve({ segments: [], language: null, elapsedMs: 300 });
    await tick();
    expect(t.lines).toEqual([]);
    expect(t.persisted).toEqual([]);
  });

  it("stop ⇒ bỏ kết quả về muộn và việc đang chờ", async () => {
    const t = setup();
    t.engine.push(speech(20));
    t.engine.stop();
    t.asr.calls[0]?.resolve(ok("muộn"));
    await tick();
    expect(t.lines).toEqual([]);
    expect(t.asr.calls).toHaveLength(1);
  });

  it("lines() trả toàn bộ dòng hiện có (renderer gắn lại sau reload)", async () => {
    const t = setup();
    t.engine.push(speech(10));
    t.asr.calls[0]?.resolve(ok("một"));
    await tick();
    expect(t.engine.lines()).toEqual([
      { id: "w0", tStart: 0, tEnd: 10, text: "một", pending: false },
    ]);
  });
});
