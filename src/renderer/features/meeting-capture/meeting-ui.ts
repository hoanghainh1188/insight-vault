import type { MeetingState, Source } from "@shared/ipc/types";
import { END_CONFIRM_MIN_SEC } from "@shared/meeting/constants";

// 186 — quy tắc UI thuần của Ghi cuộc họp (FR-010, FR-013, A9, D15). Không React, không I/O.

/** Kết thúc ghi cần hộp xác nhận khi phiên đã dài (D15). */
export function needsEndConfirm(durationSec: number): boolean {
  return durationSec >= END_CONFIRM_MIN_SEC;
}

/** Nguồn cuộc họp đang ghi/tạm dừng: chưa có bước xử lý nào ⇒ không hiện thanh tiến độ, chỉ nhãn giai đoạn. */
export function hideSourceProgress(
  source: Pick<Source, "kind" | "meetingPhase">,
): boolean {
  return (
    source.kind === "meeting" &&
    (source.meetingPhase === "recording" || source.meetingPhase === "paused")
  );
}

/** Notebook đang có phiên ghi (ghi hoặc tạm dừng) ⇒ cột giữa ở chế độ tập trung. */
export function isRecordingNotebook(
  state: MeetingState | null,
  notebookId: string,
): boolean {
  return (
    state !== null &&
    state.notebookId === notebookId &&
    (state.phase === "recording" || state.phase === "paused")
  );
}
