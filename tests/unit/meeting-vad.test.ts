import { describe, it, expect } from "vitest";
import {
  isSpeechWindow,
  frameDbfs,
} from "../../src/main/services/meeting-capture/vad";

// 186 PR B (R6) — VAD theo năng lượng: cửa sổ im lặng không gửi ASR (tránh ảo giác "Cảm ơn đã xem" trên im lặng). THUẦN.

const SR = 16000;
const tone = (sec: number, dbfs: number, hz = 220): Int16Array => {
  const amp = 32767 * Math.SQRT2 * 10 ** (dbfs / 20); // RMS của sin = amp/√2
  return Int16Array.from({ length: sec * SR }, (_, i) =>
    Math.round(Math.min(32767, amp) * Math.sin((2 * Math.PI * hz * i) / SR)),
  );
};

describe("frameDbfs", () => {
  it("im lặng tuyệt đối ⇒ -Infinity; sin -20 dBFS ⇒ ≈ -20", () => {
    expect(frameDbfs(new Int16Array(480))).toBe(Number.NEGATIVE_INFINITY);
    expect(frameDbfs(tone(1, -20).subarray(0, 4800))).toBeCloseTo(-20, 0);
  });
});

describe("isSpeechWindow", () => {
  it("im lặng ⇒ false", () => {
    expect(isSpeechWindow(new Int16Array(10 * SR))).toBe(false);
  });

  it("nhiễu nền thấp (-60 dBFS) ⇒ false", () => {
    expect(isSpeechWindow(tone(10, -60))).toBe(false);
  });

  it("lời nói/tín hiệu rõ (-20 dBFS) ⇒ true", () => {
    expect(isSpeechWindow(tone(10, -20))).toBe(true);
  });

  it("tiếng ồn lớn rất ngắn (60 ms ở 0 dBFS trong 10 s) ⇒ false", () => {
    const pcm = new Int16Array(10 * SR);
    pcm.set(tone(1, -1).subarray(0, 960), 5 * SR);
    expect(isSpeechWindow(pcm)).toBe(false);
  });

  it("nói 2 s trong 10 s (≥ 10%) ⇒ true; ngưỡng và tỉ lệ chỉnh được", () => {
    const pcm = new Int16Array(10 * SR);
    pcm.set(tone(2, -30), 3 * SR);
    expect(isSpeechWindow(pcm)).toBe(true);
    expect(isSpeechWindow(pcm, -45, 0.3)).toBe(false);
    expect(isSpeechWindow(pcm, -25)).toBe(false);
  });

  it("cửa sổ rỗng ⇒ false", () => {
    expect(isSpeechWindow(new Int16Array(0))).toBe(false);
  });
});
