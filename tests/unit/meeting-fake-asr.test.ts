import { describe, it, expect } from "vitest";
import { fakeTranscribe } from "../../src/main/services/meeting-capture/fake-asr";

// 186 — ASR giả tất định cho e2e (IV_ASR_FAKE, R15). Hàm thuần.

const RATE = 16000;
function pcm(windows: ("tone" | "silence")[], windowSec = 10): Int16Array {
  const out = new Int16Array(windows.length * windowSec * RATE);
  windows.forEach((w, wi) => {
    if (w === "silence") return;
    for (let i = 0; i < windowSec * RATE; i++) {
      out[wi * windowSec * RATE + i] = Math.round(
        0.3 * 0x7fff * Math.sin((2 * Math.PI * 440 * i) / RATE),
      );
    }
  });
  return out;
}

describe("fakeTranscribe", () => {
  it("mỗi cửa sổ 10 s có tín hiệu ⇒ một segment 'đoạn <n>' đúng mốc (thời gian tương đối đầu vào)", () => {
    const out = fakeTranscribe(pcm(["tone", "tone"]), RATE);
    expect(out).toEqual([
      { text: "đoạn 1", tStart: 0, tEnd: 10 },
      { text: "đoạn 2", tStart: 10, tEnd: 20 },
    ]);
  });

  it("cửa sổ im lặng ⇒ không có segment", () => {
    const out = fakeTranscribe(pcm(["tone", "silence", "tone"]), RATE);
    expect(out.map((s) => s.text)).toEqual(["đoạn 1", "đoạn 3"]);
  });

  it("cửa sổ cuối ngắn hơn 10 s ⇒ tEnd theo độ dài thật", () => {
    const p = pcm(["tone"]).subarray(0, 4 * RATE);
    expect(fakeTranscribe(p, RATE)).toEqual([
      { text: "đoạn 1", tStart: 0, tEnd: 4 },
    ]);
  });

  it("tất định", () => {
    const p = pcm(["tone", "silence"]);
    expect(fakeTranscribe(p, RATE)).toEqual(fakeTranscribe(p, RATE));
  });

  it("đầu vào rỗng ⇒ []", () => {
    expect(fakeTranscribe(new Int16Array(0), RATE)).toEqual([]);
  });
});
