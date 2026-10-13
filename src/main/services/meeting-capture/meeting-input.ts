import type {
  MeetingLanguageState,
  MeetingMarkerKind,
} from "@shared/ipc/types";
import { UserFacingError } from "@shared/codes/user-error";
import type { LanguageEvent, LanguageState } from "./language-policy";

// 186 PR B — kiểm đầu vào kênh meeting:setLanguage / meeting:mark (data-model §6) + dựng trạng thái ngôn ngữ cho renderer.
// THUẦN. Đầu vào từ renderer là dữ liệu không tin cậy ⇒ sai ném UserFacingError("meetingInvalidInput").

const MARKER_KINDS: readonly MeetingMarkerKind[] = [
  "decision",
  "actionItem",
  "question",
];
/** Dung sai đánh dấu vượt thời lượng (lô cuối có thể chưa tới main). */
const MARK_SLACK_SEC = 1;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const invalid = (): never => {
  throw new UserFacingError("meetingInvalidInput");
};

/** meeting:setLanguage ⇒ sự kiện cho languagePolicy (atSec = thời lượng audio hiện tại). */
export function parseSetLanguage(input: unknown, atSec: number): LanguageEvent {
  if (!isObj(input)) return invalid();
  switch (input["action"]) {
    case "lock": {
      const lang = input["lang"];
      return lang === "vi" || lang === "en"
        ? { type: "userLock", lang, atSec }
        : invalid();
    }
    case "acceptSuggestion":
      return { type: "acceptSuggestion", atSec };
    case "dismissSuggestion":
      return { type: "dismissSuggestion" };
    default:
      return invalid();
  }
}

export interface MarkInput {
  kind: MeetingMarkerKind;
  tStart: number;
  tEnd: number;
}

/** meeting:mark: kind ∈ enum; 0 ≤ tStart ≤ tEnd ≤ thời lượng + 1 s; thiếu tEnd ⇒ đánh dấu điểm. */
export function parseMark(input: unknown, durationSec: number): MarkInput {
  if (!isObj(input)) return invalid();
  const kind = input["kind"];
  const tStart = input["tStart"];
  const tEnd = input["tEnd"] === undefined ? tStart : input["tEnd"];
  if (
    !MARKER_KINDS.includes(kind as MeetingMarkerKind) ||
    !isNum(tStart) ||
    !isNum(tEnd) ||
    tStart < 0 ||
    tEnd < tStart ||
    tEnd > durationSec + MARK_SLACK_SEC
  ) {
    return invalid();
  }
  return { kind: kind as MeetingMarkerKind, tStart, tEnd };
}

export function languageView(s: LanguageState): MeetingLanguageState {
  const status: MeetingLanguageState["status"] =
    s.mode === "multi"
      ? "multi"
      : s.locked?.source === "user"
        ? "manual"
        : s.locked
          ? "locked"
          : "detecting";
  return {
    mode: s.mode,
    current: s.mode === "multi" ? null : (s.locked?.lang ?? null),
    status,
    ...(s.suggestion ? { suggestion: s.suggestion } : {}),
  };
}
