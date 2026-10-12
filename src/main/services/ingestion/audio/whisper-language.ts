// Phát hiện ngôn ngữ cho Whisper (194) — phần THUẦN, unit-test kỹ. transformers.js 4.x thiếu `language` thì
// KHÔNG tự nhận dạng mà mặc định tiếng Anh ⇒ audio tiếng Việt ra transcript tiếng Anh ảo giác. Cách chữa (spike S2
// #186, ADR 2026-10-12-meeting-asr-spike): encoder trên 30 s đầu + MỘT bước decoder sau <|startoftranscript|>, so
// logits <|vi|>/<|en|> ở vị trí cuối, softmax trên 2 token, rồi truyền `language` tường minh cho pipeline.
// Dùng chung cho nạp audio (045) và Meeting Capture (186).

export type AsrLanguage = "vi" | "en";

export const SAMPLE_RATE = 16000;
/** Whisper nhìn tối đa 30 s/lượt encoder — cũng là cửa sổ phát hiện ngôn ngữ. */
export const LANG_DETECT_WINDOW_SEC = 30;

export const WHISPER_TOKENS = {
  sot: "<|startoftranscript|>",
  vi: "<|vi|>",
  en: "<|en|>",
} as const;

const WHISPER_LANGUAGE_NAME: Record<AsrLanguage, "vietnamese" | "english"> = {
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

/**
 * P(vi) từ logits [1, steps, vocab] (row-major): chỉ đọc vị trí CUỐI, softmax trên đúng 2 token <|vi|>, <|en|>.
 * Dạng sigmoid của hiệu logit, viết ổn định số học (không tràn khi chênh lệch lớn).
 */
export function probVietnamese(
  data: ArrayLike<number>,
  dims: readonly number[],
  ids: LanguageTokenIds,
): number {
  if (dims.length !== 3) {
    throw new Error(`logits must be [1, steps, vocab], got [${dims}]`);
  }
  const steps = dims[1] as number;
  const vocab = dims[2] as number;
  if (ids.vi >= vocab || ids.en >= vocab) {
    throw new Error(`language token id exceeds vocab (${vocab})`);
  }
  const base = (steps - 1) * vocab;
  const lv = data[base + ids.vi] as number;
  const le = data[base + ids.en] as number;
  if (!Number.isFinite(lv) || !Number.isFinite(le)) {
    throw new Error("language logits are not finite");
  }
  const d = le - lv;
  if (d >= 0) {
    const e = Math.exp(-d);
    return e / (1 + e);
  }
  return 1 / (1 + Math.exp(d));
}

export function pickLanguage(pVi: number): AsrLanguage {
  return pVi >= 0.5 ? "vi" : "en";
}

/** 30 s đầu (view, không chép) — audio ngắn hơn thì giữ nguyên. */
export function detectionWindow(pcm16k: Float32Array): Float32Array {
  return pcm16k.subarray(0, SAMPLE_RATE * LANG_DETECT_WINDOW_SEC);
}

/** Tham số `language`/`task` tường minh cho pipeline ASR — không bao giờ để pipeline tự chọn. */
export function asrLanguageOptions(lang: AsrLanguage): AsrLanguageOptions {
  return { language: WHISPER_LANGUAGE_NAME[lang], task: "transcribe" };
}
