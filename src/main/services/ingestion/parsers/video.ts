import { readFile } from "node:fs/promises";
import { existsSync, unlinkSync } from "node:fs";
import type { ParseResult } from "./index";
import { parseAudio } from "./audio";
import type { Transcriber } from "../audio/transcribe";

// Parser video (051): tách audio (ffmpeg) → wav 16kHz → tái dùng NGUYÊN parseAudio (045). Video KHÔNG có
// audio track → transcript rỗng (0 chunk), video vẫn phát được (FR-011). Wav tạm xoá ở finally.
// DI extractor + transcriber → unit-test không cần ffmpeg/Whisper thật.

export type AudioExtractor = (
  videoPath: string,
  outDir: string,
) => Promise<string | null>;

export async function parseVideo(
  videoPath: string,
  tmpDir: string,
  extract: AudioExtractor,
  transcriber: Transcriber,
  onProgress?: (frac: number) => void,
): Promise<ParseResult> {
  onProgress?.(0); // bắt đầu bước tách audio
  const wavPath = await extract(videoPath, tmpDir);
  if (!wavPath) {
    // Không có audio track → transcript rỗng; pageCount null, pages rỗng (pipeline cho phép với video).
    return { pageCount: null, pages: [], timeMap: [] };
  }
  try {
    const wavBytes = new Uint8Array(await readFile(wavPath));
    // parseAudio nhận tiến độ 0..1 cho phần bóc băng (nối tiếp sau tách).
    return await parseAudio(wavBytes, transcriber, onProgress);
  } finally {
    if (existsSync(wavPath)) {
      try {
        unlinkSync(wavPath);
      } catch {
        /* bỏ qua dọn file tạm */
      }
    }
  }
}
