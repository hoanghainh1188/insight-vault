import type { MeetingPhase } from "@shared/ipc/types";
import { BATCH_MAX_BYTES, MAX_BATCHES_PER_SEC } from "./meeting-constants";

// 186 — kiểm lô PCM renderer→main qua kênh send meeting:audio (R4). THUẦN, không ném: mọi lô xấu bị bỏ có lý do.
// Không đọc/log NỘI DUNG audio — chỉ kích thước, thứ tự, nguồn gửi.

export interface IngressState {
  sessionId: string;
  /** webContents.id của cửa sổ đã bắt đầu phiên. */
  ownerId: number;
  phase: MeetingPhase;
  expectedSeq: number;
  windowStartMs: number;
  batchesInWindow: number;
}

export interface IngressMessage {
  senderId: number;
  sessionId: unknown;
  seq: unknown;
  pcm: unknown;
}

export type IngressVerdict =
  | {
      verdict: "accept";
      bytes: Uint8Array;
      gapBatches: number;
      next: IngressState;
    }
  | { verdict: "duplicate" }
  | { verdict: "rateLimited"; next: IngressState }
  | { verdict: "reject"; reason: "session" | "sender" | "phase" | "payload" };

function toBytes(pcm: unknown): Uint8Array | null {
  if (pcm instanceof ArrayBuffer) return new Uint8Array(pcm);
  if (pcm instanceof Uint8Array) return pcm;
  return null;
}

export function validateAudioBatch(
  state: IngressState | null,
  msg: IngressMessage,
  nowMs: number,
): IngressVerdict {
  if (
    !state ||
    typeof msg.sessionId !== "string" ||
    msg.sessionId !== state.sessionId
  ) {
    return { verdict: "reject", reason: "session" };
  }
  if (msg.senderId !== state.ownerId)
    return { verdict: "reject", reason: "sender" };
  if (state.phase !== "recording")
    return { verdict: "reject", reason: "phase" };

  const bytes = toBytes(msg.pcm);
  const seq = msg.seq;
  if (
    !bytes ||
    bytes.byteLength === 0 ||
    bytes.byteLength % 2 !== 0 ||
    bytes.byteLength > BATCH_MAX_BYTES ||
    typeof seq !== "number" ||
    !Number.isInteger(seq) ||
    seq < 0
  ) {
    return { verdict: "reject", reason: "payload" };
  }
  if (seq < state.expectedSeq) return { verdict: "duplicate" };

  const inWindow = nowMs - state.windowStartMs < 1000;
  const windowStartMs = inWindow ? state.windowStartMs : nowMs;
  const batchesInWindow = inWindow ? state.batchesInWindow : 0;
  if (batchesInWindow >= MAX_BATCHES_PER_SEC) {
    return {
      verdict: "rateLimited",
      next: { ...state, windowStartMs, batchesInWindow },
    };
  }

  return {
    verdict: "accept",
    bytes,
    gapBatches: seq - state.expectedSeq,
    next: {
      ...state,
      expectedSeq: seq + 1,
      windowStartMs,
      batchesInWindow: batchesInWindow + 1,
    },
  };
}
