import type {
  LanguageMode,
  MeetingPrepareResult,
  MeetingStartInput,
} from "@shared/ipc/types";
import { UserFacingError } from "@shared/codes/user-error";
import { canStart, minutesRemaining } from "./disk-guard";
import { BYTES_PER_MIN, FINAL_MODEL_SIZE_MB } from "./meeting-constants";
import type { MeetingServiceDeps } from "./meeting-service";

// 186 — hộp "Ghi cuộc họp": meeting:prepare (quyền micro, đĩa, model, lựa chọn lần trước — D15) + kiểm đầu vào meeting:start
// (data-model §6). Tách khỏi meeting-service để file gọn; không giữ trạng thái phiên.

export const LANGUAGE_MODES: readonly LanguageMode[] = [
  "auto",
  "vi",
  "en",
  "multi",
];
const TITLE_MAX = 200;
export const PREF_DEVICE = "meeting.lastDeviceLabel";
export const PREF_LANGUAGE = "meeting.lastLanguageMode";

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

export function cleanTitle(v: unknown): string {
  const t = typeof v === "string" ? v.trim() : "";
  if (t === "" || t.length > TITLE_MAX)
    throw new UserFacingError("meetingInvalidInput");
  return t;
}

export function parseStartInput(input: unknown): MeetingStartInput {
  if (!isObj(input)) throw new UserFacingError("meetingInvalidInput");
  const notebookId = str(input["notebookId"]);
  const languageMode = input["languageMode"] as LanguageMode;
  const deviceLabel = input["deviceLabel"];
  const title = cleanTitle(input["title"]);
  if (
    !notebookId ||
    !LANGUAGE_MODES.includes(languageMode) ||
    (deviceLabel !== undefined &&
      (typeof deviceLabel !== "string" || deviceLabel.length > TITLE_MAX))
  ) {
    throw new UserFacingError("meetingInvalidInput");
  }
  return {
    notebookId,
    languageMode,
    title,
    ...(typeof deviceLabel === "string" ? { deviceLabel } : {}),
  };
}

/** `idle` = chưa có phiên và không đang bắt đầu ⇒ được mở cổng quyền micro + canStart. */
export async function prepareMeeting(
  deps: MeetingServiceDeps,
  idle: boolean,
  input: unknown,
): Promise<MeetingPrepareResult> {
  if (!isObj(input) || !str(input["notebookId"]))
    throw new UserFacingError("meetingInvalidInput");
  const notebookOk = deps.notebookExists(str(input["notebookId"]) as string);
  let micStatus = deps.testFakeMic ? "granted" : deps.mediaAccess.status();
  if (micStatus === "notDetermined")
    micStatus = (await deps.mediaAccess.ask()) ? "granted" : "denied";
  // M1: chỉ mở cổng quyền micro khi thật sự sắp bắt đầu một phiên mới.
  if (idle && notebookOk) deps.micGate.arm();
  const minutes = minutesRemaining({
    freeBytes: await deps.freeBytes(),
    recordedBytes: 0,
    bytesPerMin: BYTES_PER_MIN,
  });
  const lastDevice = deps.prefs.get(PREF_DEVICE);
  const lastLanguage = deps.prefs.get(PREF_LANGUAGE);
  return {
    micStatus,
    modelReady: await deps.isModelReady(),
    modelSizeMb: FINAL_MODEL_SIZE_MB,
    minutesRemaining: minutes,
    canStart:
      notebookOk &&
      micStatus !== "denied" &&
      micStatus !== "restricted" &&
      canStart(minutes) &&
      idle,
    onlineActive: deps.isOnlineActive(),
    recordingActive: !idle,
    ...(typeof lastDevice === "string" ? { lastDeviceLabel: lastDevice } : {}),
    ...(deps.testFakeMic ? { testFakeMic: true as const } : {}),
    ...(LANGUAGE_MODES.includes(lastLanguage as LanguageMode)
      ? { lastLanguageMode: lastLanguage as LanguageMode }
      : {}),
  };
}
