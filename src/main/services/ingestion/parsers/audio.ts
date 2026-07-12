import type { ParseResult } from "./index";
import { decodeAudio } from "../audio/decode";
import { resampleTo16k } from "../audio/resample";
import { buildTranscript } from "../audio/audio-transcript";
import type { Transcriber } from "../audio/transcribe";

// Parser audio (045): giải mã → PCM 16kHz → bóc băng (Whisper) → transcript + timeMap. I/O wiring (decode/
// transcribe) — loại coverage; phần thuần (resample/buildTranscript) test riêng. 1 "trang" text (page=null).
export async function parseAudio(
  bytes: Uint8Array,
  transcriber: Transcriber,
  onProgress?: (frac: number) => void,
): Promise<ParseResult> {
  const decoded = await decodeAudio(bytes);
  const pcm16k = resampleTo16k(decoded.samples, decoded.sampleRate);
  const segments = await transcriber.transcribe(pcm16k, onProgress);
  const { text, timeMap } = buildTranscript(segments);
  return { pageCount: null, pages: [{ page: null, text }], timeMap };
}
