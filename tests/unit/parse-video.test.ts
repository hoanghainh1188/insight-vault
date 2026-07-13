import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseVideo } from "../../src/main/services/ingestion/parsers/video";
import type { Transcriber } from "../../src/main/services/ingestion/audio/transcribe";

// Fake transcriber (DI) — không cần Whisper. Trả 1 segment cố định.
const fakeTranscriber: Transcriber = {
  transcribe: async () => [
    { text: "xin chào đây là video", tStart: 0, tEnd: 2 },
  ],
};

// WAV PCM 16-bit mono 16kHz hợp lệ để audio-decode giải mã thật (chỉ transcriber là giả).
function buildWav(numSamples: number, rate = 16000): Buffer {
  const dataLen = numSamples * 2;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28); // byteRate
  buf.writeUInt16LE(2, 32); // blockAlign
  buf.writeUInt16LE(16, 34); // bits
  buf.write("data", 36);
  buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < numSamples; i++) {
    buf.writeInt16LE(Math.round(Math.sin(i / 8) * 3000), 44 + i * 2);
  }
  return buf;
}

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "iv-pv-"));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("parseVideo (051)", () => {
  it("video KHÔNG có audio (extractor→null) → ParseResult rỗng (không chip)", async () => {
    const res = await parseVideo(
      "in.mp4",
      dir,
      async () => null,
      fakeTranscriber,
    );
    expect(res.pages).toEqual([]);
    expect(res.timeMap).toEqual([]);
  });

  it("có audio → transcript đầy đủ + wav tạm được xoá (finally)", async () => {
    const wavPath = join(dir, "extracted.wav");
    writeFileSync(wavPath, buildWav(1600)); // 0.1s @16kHz
    const extractor = async (): Promise<string> => wavPath;
    const res = await parseVideo("in.mp4", dir, extractor, fakeTranscriber);
    expect(res.pages.length).toBe(1);
    expect(res.pages[0].text).toContain("xin chào");
    expect(res.timeMap && res.timeMap.length).toBeGreaterThan(0);
    expect(existsSync(wavPath)).toBe(false); // đã dọn
  });

  it("parseAudio ném (bytes hỏng) → vẫn xoá wav tạm rồi ném lại", async () => {
    const wavPath = join(dir, "bad.wav");
    writeFileSync(wavPath, Buffer.from("not-a-wav"));
    await expect(
      parseVideo("in.mp4", dir, async () => wavPath, fakeTranscriber),
    ).rejects.toThrow();
    expect(existsSync(wavPath)).toBe(false); // finally dọn kể cả khi lỗi
  });
});
