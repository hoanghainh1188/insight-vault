import type { DetectedLanguageCode } from "../../meeting-capture/language-detect";

// Phát hiện ngôn ngữ cho Whisper (194) — phần THUẦN, unit-test kỹ. transformers.js 4.x thiếu `language` thì
// KHÔNG tự nhận dạng mà mặc định tiếng Anh ⇒ audio tiếng Việt ra transcript tiếng Anh ảo giác. Cách chữa (spike S2
// #186, ADR 2026-10-12-meeting-asr-spike): encoder trên 30 s đầu + MỘT bước decoder sau <|startoftranscript|>, lấy
// logits <|vi|>/<|en|> ở vị trí cuối, rồi truyền `language` tường minh cho pipeline. Phần chọn ngôn ngữ (softmax trên
// 2 token) dùng lại `pickLanguage` của Meeting Capture (`meeting-capture/language-detect.ts`) — không nhân đôi.

export const SAMPLE_RATE = 16000;
/** Whisper nhìn tối đa 30 s/lượt encoder — cũng là cửa sổ phát hiện ngôn ngữ. */
export const LANG_DETECT_WINDOW_SEC = 30;

export const WHISPER_TOKENS = {
  sot: "<|startoftranscript|>",
  vi: "<|vi|>",
  en: "<|en|>",
} as const;

const WHISPER_LANGUAGE_NAME: Record<
  DetectedLanguageCode,
  "vietnamese" | "english"
> = {
  vi: "vietnamese",
  en: "english",
};

export interface LanguageTokenIds {
  vi: number;
  en: number;
}

export interface AsrLanguageOptions {
  language: "vietnamese" | "english";
  task: "transcribe";
}

/** Kiểm kết quả `tokenizer.convert_tokens_to_ids` — token thiếu thì lỗi ngay, không đoán bừa. */
export function requireTokenId(value: unknown, token: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`Whisper tokenizer is missing token ${token}`);
  }
  return value;
}

/** Logits [vi, en] ở vị trí CUỐI của logits [1, steps, vocab] (row-major). Giá trị không hữu hạn để `pickLanguage` xử. */
export function lastStepLanguageLogits(
  data: ArrayLike<number>,
  dims: readonly number[],
  ids: LanguageTokenIds,
): [number, number] {
  if (dims.length !== 3) {
    throw new Error(`logits must be [1, steps, vocab], got [${dims}]`);
  }
  const steps = dims[1] as number;
  const vocab = dims[2] as number;
  if (ids.vi >= vocab || ids.en >= vocab) {
    throw new Error(`language token id exceeds vocab (${vocab})`);
  }
  const base = (steps - 1) * vocab;
  return [data[base + ids.vi] ?? Number.NaN, data[base + ids.en] ?? Number.NaN];
}

/** 30 s đầu (view, không chép) — audio ngắn hơn thì giữ nguyên. */
export function detectionWindow(pcm16k: Float32Array): Float32Array {
  return pcm16k.subarray(0, SAMPLE_RATE * LANG_DETECT_WINDOW_SEC);
}

/** Tham số `language`/`task` tường minh cho pipeline ASR — không bao giờ để pipeline tự chọn. */
export function asrLanguageOptions(
  lang: DetectedLanguageCode,
): AsrLanguageOptions {
  return { language: WHISPER_LANGUAGE_NAME[lang], task: "transcribe" };
}
