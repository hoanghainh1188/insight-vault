import type { LanguageCode } from "./languages";

// 123 (FR-017, research R10): đoán ngôn ngữ câu hỏi CHỈ khi chắc chắn (vi/en) để chỉ định tường minh ngôn ngữ câu
// trả lời trong lời nhắc; không chắc ⇒ undefined (lời nhắc vẫn dặn "trả lời theo ngôn ngữ câu hỏi cuối"). Thuần.

/** Ký tự chỉ có trong tiếng Việt (nguyên âm có dấu/mũ/móc + đ). */
const VI_CHAR =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/giu;
/** Từ chức năng English phổ biến — đủ để phân biệt với tiếng Việt không dấu và các ngôn ngữ Latin khác. */
// Bỏ các từ trùng tiếng Việt không dấu (do, to, me, as, be, in, on, it, or…) để không nhận nhầm (review 123).
const EN_FUNCTION_WORDS = new Set([
  "the",
  "is",
  "are",
  "was",
  "were",
  "what",
  "where",
  "when",
  "why",
  "how",
  "who",
  "which",
  "whose",
  "does",
  "did",
  "of",
  "for",
  "and",
  "about",
  "with",
  "from",
  "this",
  "that",
  "these",
  "those",
  "its",
  "can",
  "could",
  "should",
  "would",
  "will",
  "there",
  "please",
  "explain",
  "summarize",
  "describe",
  "list",
  "tell",
  "my",
  "your",
  "by",
]);
/** Cần ≥ 2 từ chức năng English (1 từ dễ trùng ngẫu nhiên, vd "the" trong "the nao"). */
const MIN_EN_FUNCTION_WORDS = 2;
const MIN_WORDS = 3;
/** ≥ 1 ký tự Việt trên 15 chữ cái ⇒ câu tiếng Việt (câu English có vài tên riêng Việt vẫn dưới ngưỡng). */
const VI_DENSITY = 1 / 15;

export function detectQuestionLanguage(text: string): LanguageCode | undefined {
  const cleaned = text
    .replace(/\[\d+\]/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\d+/g, " ");
  const words = cleaned.match(/\p{L}+/gu) ?? [];
  if (words.length < MIN_WORDS) return undefined;
  const letters = words.reduce((n, w) => n + w.length, 0);
  const viChars = (cleaned.match(VI_CHAR) ?? []).length;
  if (viChars >= letters * VI_DENSITY) return "vi";
  const lower = words.map((w) => w.toLowerCase());
  const asciiWords = lower.filter((w) => /^[a-z]+$/.test(w)).length;
  const functionWords = lower.filter((w) => EN_FUNCTION_WORDS.has(w)).length;
  if (functionWords >= MIN_EN_FUNCTION_WORDS && asciiWords * 2 >= words.length)
    return "en";
  return undefined;
}
