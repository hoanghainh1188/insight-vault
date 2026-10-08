import type { StudioKind } from "@shared/ipc/types";
import type { LanguageCode } from "@shared/i18n";

// System prompt cho Studio (ADR 2026-07-11-studio-context-strategy). Hàm THUẦN — test tất định.
// Khung chung ép: chỉ dùng đoạn ĐÁNH SỐ, chèn [n], KHÔNG bịa (Constitution II — kiểm chứng được; nội dung luôn truy
// được về chunk thật qua [n]). 123 (FR-018, FR-019): lời nhắc English; ngôn ngữ đầu ra = ngôn ngữ giao diện lúc tạo.

export const OUTPUT_LANGUAGE_NAME: Record<LanguageCode, string> = {
  vi: "Vietnamese",
  en: "English",
};

/** Nhãn FAQ theo ngôn ngữ đầu ra (định dạng văn bản; không code nào parse). */
const FAQ_LABELS: Record<LanguageCode, { q: string; a: string }> = {
  vi: { q: "Hỏi", a: "Đáp" },
  en: { q: "Q", a: "A" },
};

export function outputLanguageLine(lang: LanguageCode): string {
  return `Write in ${OUTPUT_LANGUAGE_NAME[lang]}, clearly and concisely.`;
}

/**
 * Nhắc lại ngôn ngữ đầu ra ở CUỐI system prompt và cuối tin người dùng: nguồn khác ngôn ngữ giao diện ⇒ model cục bộ nhỏ
 * hay viết theo ngôn ngữ nguồn khi chỉ dẫn nằm giữa đoạn (quickstart 123: Tóm tắt ra tiếng Việt khi giao diện English).
 */
export function languageReminder(lang: LanguageCode): string {
  return `Write your entire answer in ${OUTPUT_LANGUAGE_NAME[lang]}, even if the source passages are in another language.`;
}

function common(lang: LanguageCode): string {
  return [
    "You are an assistant that synthesizes documents. Below are source passages NUMBERED [1], [2], …",
    "Use only the information in those passages; NEVER make anything up or add outside knowledge.",
    "REQUIRED: every point/sentence must end with at least one matching citation chip [n] (n is the passage number); a sentence WITHOUT [n] is invalid. Example: 'The document lists three main goals [2].'",
    "Cover ALL source passages (every document) in a balanced way — do NOT focus only on the first or last few passages.",
    outputLanguageLine(lang),
  ].join(" ");
}

function task(kind: StudioKind, lang: LanguageCode): string | undefined {
  const faq = FAQ_LABELS[lang];
  const byKind: Record<StudioKind, string> = {
    summary:
      "Task: write a concise SUMMARY of the whole document in a few paragraphs/bullet points covering the main content.",
    keyPoints:
      "Task: list the KEY POINTS as a bulleted list, one point per line starting with '- '.",
    faq: `Task: write frequently asked QUESTIONS AND ANSWERS from the document, each pair formatted as '${faq.q}: …' then '${faq.a}: … [n]'.`,
    outline:
      "Task: build a hierarchical OUTLINE of the document (main sections and indented subsections) reflecting its structure.",
  };
  return byKind[kind];
}

/** Trả system prompt theo loại + ngôn ngữ đầu ra. Ném nếu kind không hợp lệ (biên hệ thống). */
export function systemPromptFor(
  kind: StudioKind,
  outputLanguage: LanguageCode = "vi",
): string {
  const t = task(kind, outputLanguage);
  if (!t) {
    throw new Error(`Invalid StudioKind: ${String(kind)}`);
  }
  return `${common(outputLanguage)}\n\n${t}\n${languageReminder(outputLanguage)}`;
}
