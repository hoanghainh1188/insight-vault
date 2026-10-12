import type { LanguageMode } from "@shared/ipc/types";

// 186 — phát hiện ngôn ngữ cho bản chốt (ADR spike S2). THUẦN. Worker chạy encoder trên ≤ 30 s + MỘT bước decoder sau
// <|startoftranscript|>, lấy logits của <|vi|>/<|en|>; ở đây chỉ chọn + tính độ tin cậy (softmax trên 2 token).
// Bản chốt KHÔNG để Whisper tự chọn: transformers.js khi thiếu `language` mặc định tiếng Anh ⇒ tiếng Việt thành rác.

export type DetectedLanguageCode = "vi" | "en";

export interface DetectedLanguage {
  language: DetectedLanguageCode;
  /** Xác suất của ngôn ngữ được chọn, 0,5..1. */
  confidence: number;
}

export function pickLanguage(
  logitVi: number,
  logitEn: number,
): DetectedLanguage | null {
  if (!Number.isFinite(logitVi) || !Number.isFinite(logitEn)) return null;
  const pVi = 1 / (1 + Math.exp(logitEn - logitVi));
  return pVi >= 0.5
    ? { language: "vi", confidence: pVi }
    : { language: "en", confidence: 1 - pVi };
}

/** Ngôn ngữ truyền cho bản chốt: chế độ khoá thắng; auto/multi dùng ngôn ngữ đã phát hiện (null nếu chưa có). */
export function resolveFinalLanguage(
  mode: LanguageMode,
  detected: DetectedLanguageCode | null,
): DetectedLanguageCode | null {
  return mode === "vi" || mode === "en" ? mode : detected;
}
