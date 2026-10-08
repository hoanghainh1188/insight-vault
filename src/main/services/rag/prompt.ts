import type { RagMode } from "@shared/ipc/types";
import type { LanguageCode } from "@shared/i18n";

// System prompt 2 chế độ (ADR retrieval-strategy §3). Hàm THUẦN. KHÔNG log nội dung (Constitution III).
// 123 (FR-017, FR-019, research R8): một bản lời nhắc ENGLISH + chỉ dẫn ngôn ngữ đầu ra theo câu hỏi. "Không tìm
// thấy" do app quyết theo cấu trúc (không [n] hợp lệ ⇒ notFound) — không bắt model trả câu nguyên văn.

const LANGUAGE_NAME: Record<LanguageCode, string> = {
  vi: "Vietnamese",
  en: "English",
};

/** Luôn dặn trả lời theo ngôn ngữ câu hỏi cuối; chỉ định rõ khi đã nhận diện chắc chắn (vi/en). */
export function languageDirective(lang?: LanguageCode): string {
  const base =
    "Write the answer in the same language as the user's last question.";
  return lang
    ? `${base} The question is in ${LANGUAGE_NAME[lang]}, so answer in ${LANGUAGE_NAME[lang]}.`
    : base;
}

/**
 * Chỉ dẫn khi nguồn không có câu trả lời. Đo 123 (specs/…/eval-llm-after.md, qwen2.5:7b): với câu hỏi TIẾNG VIỆT, bắt
 * trả đúng câu cố định "Không tìm thấy trong nguồn." (như lời nhắc cũ) giữ tỉ lệ từ chối đúng; với câu hỏi English/không
 * rõ (thường hỏi xuyên ngôn ngữ trên nguồn tiếng Việt), câu cố định làm model từ chối nhầm câu CÓ đáp án ⇒ dùng chỉ dẫn
 * mềm. App vẫn quyết "không tìm thấy" theo cấu trúc (không [n] hợp lệ) — đây chỉ là dẫn hướng model.
 */
export const NOT_FOUND_REPLY_VI = "Không tìm thấy trong nguồn.";

function notFoundInstruction(lang?: LanguageCode): string {
  return lang === "vi"
    ? `If the passages do not contain the answer, reply with exactly one sentence: "${NOT_FOUND_REPLY_VI}" — with NO [n] and nothing else.`
    : "If the passages do not contain the answer, say briefly that the sources do not contain it, without any [n].";
}

function sources(contextText: string): string[] {
  return [
    "",
    "--- SOURCE PASSAGES ---",
    contextText,
    "--- END OF SOURCE PASSAGES ---",
  ];
}

/** Chế độ Theo nguồn: chỉ dùng context, chèn [n], thiếu căn cứ ⇒ nói ngắn là nguồn không có, cấm bịa. */
export function groundedSystemPrompt(
  contextText: string,
  outputLanguage?: LanguageCode,
): string {
  return [
    "You are an assistant that answers ONLY from the numbered source passages [n] below.",
    "Whenever you use information from a passage, put its [n] right after that point — INCLUDING in summaries (every summarized point must carry the [n] of its passage).",
    notFoundInstruction(outputLanguage),
    "Never use knowledge outside these passages. Do not make anything up.",
    languageDirective(outputLanguage),
    ...sources(contextText),
  ].join("\n");
}

/** Chế độ Mở rộng: ưu tiên context (chèn [n]); phần ngoài nguồn gắn nhãn "ngoài nguồn" theo ngôn ngữ câu trả lời. */
export function openSystemPrompt(
  contextText: string,
  outputLanguage?: LanguageCode,
): string {
  return [
    "You are an assistant that answers questions. Prefer answering from the numbered source passages [n] below and put [n] after information taken from them.",
    'If you need general knowledge OUTSIDE the passages, you may use it, but mark that part clearly with a short note such as "(not based on sources)", written in the language of your answer (for example "(không dựa trên nguồn)" in Vietnamese), and do NOT put [n] on that part.',
    languageDirective(outputLanguage),
    ...sources(contextText),
  ].join("\n");
}

export function systemPromptFor(
  mode: RagMode,
  contextText: string,
  outputLanguage?: LanguageCode,
): string {
  return mode === "grounded"
    ? groundedSystemPrompt(contextText, outputLanguage)
    : openSystemPrompt(contextText, outputLanguage);
}
