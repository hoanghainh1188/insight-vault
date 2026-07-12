import { pipeline, env } from "@huggingface/transformers";
import { logEvent } from "../../../logging";
import type { Segment } from "./audio-transcript";

// Bóc băng audio bằng transformers.js Whisper (045, Constitution III: inference CHỈ main). Model tải lần
// đầu về cacheDir (data dir) → sau chạy offline. I/O/wiring — loại khỏi coverage (phần thuần ở
// resample.ts + audio-transcript.ts). KHÔNG log nội dung transcript.

export const DEFAULT_WHISPER_MODEL = "Xenova/whisper-base";

export interface Transcriber {
  /** onProgress(0..1): 0→~0.5 tải model (lần đầu), ~0.5→1 bóc băng. */
  transcribe(
    pcm16k: Float32Array,
    onProgress?: (frac: number) => void,
  ): Promise<Segment[]>;
}

interface AsrChunk {
  text: string;
  timestamp: [number | null, number | null];
}

export function createTranscriber(opts: {
  cacheDir: string;
  model?: string;
  /** Bật/tắt chỉ báo egress khi TẢI model lần đầu từ HF (Constitution I — badge khớp hành vi). */
  setOnline?: (online: boolean) => void;
}): Transcriber {
  const model = opts.model ?? DEFAULT_WHISPER_MODEL;
  // Model tải về data dir; không cho phép model local tuỳ tiện ngoài cache (kiểm soát nguồn).
  env.cacheDir = opts.cacheDir;
  let pipePromise: Promise<unknown> | null = null;

  return {
    async transcribe(pcm16k, onProgress) {
      if (!pipePromise) {
        logEvent("audio.whisper.load", { model });
        // Lần đầu tải weight model qua mạng (HF Hub) → báo egress; tắt khi tải xong (cache local).
        opts.setOnline?.(true);
        pipePromise = pipeline("automatic-speech-recognition", model, {
          progress_callback: (p: unknown) => {
            const pr = p as { status?: string; progress?: number };
            if (pr?.status === "progress" && typeof pr.progress === "number") {
              onProgress?.((pr.progress / 100) * 0.5);
            }
          },
        }).finally(() => opts.setOnline?.(false));
      }
      const transcriber = (await pipePromise) as (
        input: Float32Array,
        opts: object,
      ) => Promise<{ chunks?: AsrChunk[]; text?: string }>;
      onProgress?.(0.5);
      const out = await transcriber(pcm16k, {
        return_timestamps: true,
        chunk_length_s: 30,
      });
      onProgress?.(1);
      const chunks = out?.chunks ?? [];
      return chunks
        .filter((c) => typeof c.text === "string")
        .map((c) => ({
          text: c.text,
          tStart: c.timestamp?.[0] ?? 0,
          tEnd: c.timestamp?.[1] ?? c.timestamp?.[0] ?? 0,
        }));
    },
  };
}
