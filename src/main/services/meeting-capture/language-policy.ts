import type { LanguageMode } from "@shared/ipc/types";
import type { DetectedLanguageCode } from "./language-detect";
import type { LanguageChange } from "./meeting-repo";

// 186 PR B — chính sách ngôn ngữ khi ghi (research R7, clarify D6, ADR spike S2). THUẦN, không mutate.
// - vi/en: khoá tay từ 0 s, không phát hiện.
// - auto: phát hiện khi đủ 30 s lời nói ⇒ khoá (áp từ 0 s); đánh giá lại mỗi 120 s; ngôn ngữ khác thắng với tin cậy ≥ 0,7 HAI
//   lần liên tiếp ⇒ gợi ý; chấp nhận ⇒ đổi từ thời điểm chấp nhận; từ chối ⇒ không gợi ý lại ngôn ngữ đó cho tới khi phát hiện
//   quay về ngôn ngữ đang khoá. Khoá tay ⇒ dừng phát hiện.
// - multi: KHÔNG để Whisper tự chọn (spike S2: thiếu `language` ⇒ mặc định tiếng Anh) ⇒ phát hiện theo từng cửa sổ.

export const FIRST_DETECT_SPEECH_SEC = 30;
export const RECHECK_EVERY_SEC = 120;
export const SUGGEST_MIN_CONFIDENCE = 0.7;
export const SUGGEST_STREAK = 2;

export interface LanguageState {
  mode: LanguageMode;
  locked: { lang: DetectedLanguageCode; source: "auto" | "user" } | null;
  /** Chuỗi phát hiện liên tiếp khác ngôn ngữ đang khoá. */
  candidate: { lang: DetectedLanguageCode; streak: number } | null;
  suggestion: DetectedLanguageCode | null;
  dismissed: DetectedLanguageCode | null;
  changes: LanguageChange[];
  nextCheckSec: number;
}

export type LanguageEvent =
  | {
      type: "detected";
      lang: DetectedLanguageCode;
      confidence: number;
      atSec: number;
    }
  | { type: "userLock"; lang: DetectedLanguageCode; atSec: number }
  | { type: "acceptSuggestion"; atSec: number }
  | { type: "dismissSuggestion" };

export function initialLanguageState(mode: LanguageMode): LanguageState {
  const base: LanguageState = {
    mode,
    locked: null,
    candidate: null,
    suggestion: null,
    dismissed: null,
    changes: [],
    nextCheckSec: 0,
  };
  return mode === "vi" || mode === "en"
    ? {
        ...base,
        locked: { lang: mode, source: "user" },
        changes: [{ atSec: 0, lang: mode, source: "user" }],
      }
    : base;
}

/** Có cần chạy phát hiện (theo chính sách khoá) ở thời điểm này không. `multi` phát hiện theo cửa sổ — không qua đây. */
export function needsDetection(
  s: LanguageState,
  speechSec: number,
  nowSec: number,
): boolean {
  if (s.mode !== "auto" || s.locked?.source === "user") return false;
  if (!s.locked) return speechSec >= FIRST_DETECT_SPEECH_SEC;
  return nowSec >= s.nextCheckSec;
}

/** Ngôn ngữ truyền cho một cửa sổ nháp; "perWindow" ⇒ worker phát hiện trên chính cửa sổ đó (chưa khoá / multi). */
export function windowLanguage(
  s: LanguageState,
): DetectedLanguageCode | "perWindow" {
  return s.mode === "multi" || !s.locked ? "perWindow" : s.locked.lang;
}

function onDetected(
  s: LanguageState,
  e: Extract<LanguageEvent, { type: "detected" }>,
): LanguageState {
  if (s.mode !== "auto" || s.locked?.source === "user") return s;
  const nextCheckSec = e.atSec + RECHECK_EVERY_SEC;
  if (!s.locked) {
    return {
      ...s,
      locked: { lang: e.lang, source: "auto" },
      changes: [{ atSec: 0, lang: e.lang, source: "auto" }],
      nextCheckSec,
    };
  }
  if (e.lang === s.locked.lang)
    return { ...s, candidate: null, dismissed: null, nextCheckSec };
  if (e.confidence < SUGGEST_MIN_CONFIDENCE || e.lang === s.dismissed)
    return { ...s, candidate: null, nextCheckSec };
  const streak = s.candidate?.lang === e.lang ? s.candidate.streak + 1 : 1;
  return {
    ...s,
    candidate: { lang: e.lang, streak },
    suggestion: streak >= SUGGEST_STREAK ? e.lang : s.suggestion,
    nextCheckSec,
  };
}

export function languagePolicy(
  s: LanguageState,
  e: LanguageEvent,
): LanguageState {
  switch (e.type) {
    case "detected":
      return onDetected(s, e);
    case "acceptSuggestion": {
      if (!s.suggestion) return s;
      const lang = s.suggestion;
      return {
        ...s,
        locked: { lang, source: "auto" },
        candidate: null,
        suggestion: null,
        changes: [...s.changes, { atSec: e.atSec, lang, source: "auto" }],
      };
    }
    case "dismissSuggestion":
      return s.suggestion
        ? { ...s, dismissed: s.suggestion, suggestion: null, candidate: null }
        : s;
    case "userLock": {
      const same = s.locked?.lang === e.lang;
      return {
        ...s,
        mode: e.lang, // khoá tay = chọn hẳn một ngôn ngữ (kể cả từ multi)
        locked: { lang: e.lang, source: "user" },
        candidate: null,
        suggestion: null,
        changes: same
          ? s.changes
          : [...s.changes, { atSec: e.atSec, lang: e.lang, source: "user" }],
      };
    }
  }
}

/** Ngôn ngữ cho một phân đoạn chốt [segStart, segEnd): khoảng chiếm phần lớn theo `changes`; chưa có thay đổi ⇒ null. */
export function languageForSegment(
  changes: readonly LanguageChange[],
  segStart: number,
  segEnd: number,
): DetectedLanguageCode | null {
  const sorted = [...changes].sort((a, b) => a.atSec - b.atSec);
  if (sorted.length === 0) return null;
  const cover = new Map<DetectedLanguageCode, number>();
  sorted.forEach((c, i) => {
    const from = Math.max(segStart, i === 0 ? -Infinity : c.atSec);
    const to = Math.min(segEnd, sorted[i + 1]?.atSec ?? Infinity);
    if (to > from) cover.set(c.lang, (cover.get(c.lang) ?? 0) + (to - from));
  });
  let best: DetectedLanguageCode | null = null;
  for (const [lang, sec] of cover)
    if (best === null || sec > (cover.get(best) ?? 0)) best = lang;
  return best ?? sorted.at(-1)?.lang ?? null;
}
