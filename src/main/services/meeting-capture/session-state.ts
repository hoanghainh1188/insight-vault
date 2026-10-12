import type {
  MeetingPhase,
  SourceStatus,
  TranscriptQuality,
} from "@shared/ipc/types";

// 186 — máy trạng thái phiên ghi (data-model §5). THUẦN: nhận snapshot + sự kiện, trả snapshot MỚI (không mutate).

export interface SessionSnapshot {
  phase: MeetingPhase;
  /** true khi người dùng chủ động kết thúc (nút, xác nhận thoát, đĩa đầy tự dừng) ⇒ khởi động lại tự hoàn tất. */
  endedByUser: boolean;
}

export type SessionEvent =
  | { type: "pause"; reason: "user" | "deviceLost" }
  | { type: "resume" }
  | { type: "stop"; cause: "user" | "diskFull" | "quitConfirmed" }
  | { type: "segmentsClosed" }
  | { type: "interrupt"; cause: "rendererGone" | "noAudio" | "crash" }
  | { type: "recover"; action: "finalize" | "keepIncomplete" }
  | { type: "finalized"; quality: TranscriptQuality }
  | { type: "finalizeFailed" }
  | { type: "finalizeAgain" };

export type TransitionResult =
  | { ok: true; state: SessionSnapshot }
  | { ok: false; reason: "invalidTransition" };

const INVALID: TransitionResult = { ok: false, reason: "invalidTransition" };

function to(
  state: SessionSnapshot,
  phase: MeetingPhase,
  endedByUser = state.endedByUser,
): TransitionResult {
  return { ok: true, state: { phase, endedByUser } };
}

export function sessionTransition(
  state: SessionSnapshot,
  event: SessionEvent,
): TransitionResult {
  const { phase } = state;
  switch (event.type) {
    case "pause":
      return phase === "recording" ? to(state, "paused") : INVALID;
    case "resume":
      return phase === "paused" ? to(state, "recording") : INVALID;
    case "stop":
      return phase === "recording" || phase === "paused"
        ? to(state, "stopping", true)
        : INVALID;
    case "segmentsClosed":
      return phase === "stopping" ? to(state, "finalizing") : INVALID;
    case "interrupt":
      return phase === "recording" || phase === "paused"
        ? to(state, "interrupted", false)
        : INVALID;
    case "recover":
      if (phase !== "interrupted") return INVALID;
      return to(
        state,
        event.action === "finalize" ? "finalizing" : "incomplete",
      );
    case "finalized":
      return phase === "finalizing" ? to(state, "done") : INVALID;
    case "finalizeFailed":
      return phase === "finalizing" ? to(state, "incomplete") : INVALID;
    case "finalizeAgain":
      return phase === "incomplete" || phase === "done"
        ? to(state, "finalizing")
        : INVALID;
  }
}

/** Ánh xạ phase ⇒ source.status (A9: không thêm giá trị vào CHECK status). */
export function sourceStatusForPhase(
  phase: MeetingPhase,
): Extract<SourceStatus, "processing" | "ready"> {
  return phase === "done" || phase === "incomplete" ? "ready" : "processing";
}
