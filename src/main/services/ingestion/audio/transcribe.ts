import { pipeline, env } from "@huggingface/transformers";
import { logError, logEvent } from "../../../logging";
import type { Segment } from "./audio-transcript";
import {
  createLanguageDetector,
  type LanguageDetector,
  type WhisperParts,
} from "./language-detector";
import { asrLanguageOptions, type AsrLanguage } from "./whisper-language";

// Bóc băng audio bằng transformers.js Whisper (045, Constitution III: inference CHỈ main). Model tải lần
// đầu về cacheDir (data dir) → sau chạy offline. I/O/wiring — loại khỏi coverage (phần thuần ở
// resample.ts + audio-transcript.ts + whisper-language.ts + language-detector.ts). KHÔNG log nội dung transcript.

export const DEFAULT_WHISPER_MODEL = "Xenova/whisper-base";
/** 194: bước phát hiện lỗi (bất thường) ⇒ dùng tiếng Việt — ngôn ngữ nguồn của sản phẩm; KHÔNG để pipeline tự
 * mặc định tiếng Anh (chính là bug). */
const FALLBACK_LANGUAGE: AsrLanguage = "vi";

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
  setOnline?: (online: boolean, kind?: "model") => void;
}): Transcriber {
  const model = opts.model ?? DEFAULT_WHISPER_MODEL;
  // Model tải về data dir; không cho phép model local tuỳ tiện ngoài cache (kiểm soát nguồn).
  env.cacheDir = opts.cacheDir;
  let pipePromise: Promise<unknown> | null = null;
  let detector: LanguageDetector | null = null;

  // 194: transformers.js 4.x thiếu `language` thì mặc định tiếng Anh ⇒ phát hiện {vi, en} trên 30 s đầu bằng một
  // bước decoder, dùng lại processor/tokenizer/model của chính pipeline (không tải thêm weight).
  async function detectLanguage(
    pipe: WhisperParts,
    pcm16k: Float32Array,
  ): Promise<AsrLanguage> {
    const t0 = performance.now();
    try {
      detector ??= createLanguageDetector(pipe);
      const { lang, pVi } = await detector(pcm16k);
      // Chỉ log ngôn ngữ + xác suất + thời gian — KHÔNG log nội dung transcript.
      logEvent("audio.whisper.language", {
        lang,
        pVi: Number(pVi.toFixed(3)),
        ms: Math.round(performance.now() - t0),
      });
      return lang;
    } catch (e) {
      logError("audio.whisper.language_failed", {
        message: e instanceof Error ? e.message : String(e),
        fallback: FALLBACK_LANGUAGE,
      });
      return FALLBACK_LANGUAGE;
    }
  }

  return {
    async transcribe(pcm16k, onProgress) {
      if (!pipePromise) {
        logEvent("audio.whisper.load", { model });
        // Lần đầu tải weight model qua mạng (HF Hub) → báo egress; tắt khi tải xong (cache local).
        opts.setOnline?.(true, "model");
        pipePromise = pipeline("automatic-speech-recognition", model, {
          progress_callback: (p: unknown) => {
            const pr = p as { status?: string; progress?: number };
            if (pr?.status === "progress" && typeof pr.progress === "number") {
              onProgress?.((pr.progress / 100) * 0.5);
            }
          },
        }).finally(() => opts.setOnline?.(false, "model"));
      }
      const transcriber = (await pipePromise) as ((
        input: Float32Array,
        opts: object,
      ) => Promise<{ chunks?: AsrChunk[]; text?: string }>) &
        WhisperParts;
      onProgress?.(0.5);
      const lang = await detectLanguage(transcriber, pcm16k);
      const out = await transcriber(pcm16k, {
        return_timestamps: true,
        chunk_length_s: 30,
        ...asrLanguageOptions(lang),
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
