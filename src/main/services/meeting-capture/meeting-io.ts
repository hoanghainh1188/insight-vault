import type { Segment } from "../ingestion/audio/audio-transcript";
import type { AsrErrorCode, AsrLanguage } from "./asr-protocol";
import type { CaptureSegment } from "./segments";
import type { DetectedLanguage } from "./language-detect";
import type { PersistedDraftLine } from "./draft-engine";
import type { MeetingCheckpoint } from "./checkpoint";

// 186 — hợp đồng I/O của Ghi cuộc họp (writer phân đoạn, tệp phiên, client ASR) + lỗi ASR. Tách riêng để service và
// finalizer cùng dùng mà không import vòng.

export class AsrError extends Error {
  constructor(readonly code: AsrErrorCode) {
    super(code);
    this.name = "AsrError";
  }
}

/** Ghi một phân đoạn WAV tăng dần (I/O ở capture-writer.ts). */
export interface CaptureSegmentWriter {
  /** Đưa PCM vào hàng ghi (không chờ đĩa). */
  append(bytes: Uint8Array): void;
  samples(): number;
  /** Ghi nốt + header đúng + fsync. Trả số mẫu. */
  close(): Promise<number>;
}

/** Thao tác tệp của phiên (I/O ở meeting-files.ts). Đường dẫn luôn nằm trong `meetingsRoot`. */
export interface MeetingFiles {
  meetingsRoot: string;
  segmentPath(sessionId: string, index: number): string;
  ensureSessionDir(sessionId: string): Promise<void>;
  openWriter(
    sessionId: string,
    index: number,
    onError: (e: unknown) => void,
  ): CaptureSegmentWriter;
  /** Sửa header phân đoạn ghi dở sau sự cố; trả danh sách với `samples` thật, mọi phân đoạn `closed`. */
  repairSegments(
    sessionId: string,
    segments: readonly CaptureSegment[],
  ): Promise<CaptureSegment[]>;
  readFinal(sessionId: string, index: number): Promise<Segment[] | null>;
  writeFinal(
    sessionId: string,
    index: number,
    segments: readonly Segment[],
  ): Promise<void>;
  mergeSegments(
    sessionId: string,
    segments: readonly CaptureSegment[],
  ): Promise<void>;
  deleteSegments(
    sessionId: string,
    segments: readonly CaptureSegment[],
  ): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  /** PR B: append một dòng nháp đã xong vào draft.jsonl (dự phòng khi bản chốt lỗi). */
  appendDraft(sessionId: string, line: PersistedDraftLine): Promise<void>;
  /** Dòng nháp hợp lệ, id trùng lấy bản sau, xếp theo tStart; thiếu tệp ⇒ []. */
  readDrafts(sessionId: string): Promise<Segment[]>;
  /** PR C1: checkpoint session.json (tmp→rename + fsync). */
  writeCheckpoint(sessionId: string, cp: MeetingCheckpoint): Promise<void>;
  /** Checkpoint hợp lệ hoặc null (thiếu / hỏng — dữ liệu đĩa không tin cậy). */
  readCheckpoint(sessionId: string): Promise<MeetingCheckpoint | null>;
}

export interface AsrFinalClient {
  /** Segment trả về có thời gian TƯƠNG ĐỐI đầu phân đoạn hiện tại (vùng ngữ cảnh của phân đoạn trước có giá trị âm). */
  final(req: {
    segmentPath: string;
    prevSegmentPath?: string;
    overlapSec: number;
    /** "perWindow" = Đa ngôn ngữ: worker phát hiện theo từng cửa sổ 30 s (ADR spike mục 6). */
    language: AsrLanguage | "perWindow";
  }): Promise<Segment[]>;
  /** Ngôn ngữ của ≤ 30 s đầu phân đoạn — một bước decoder giới hạn {vi, en} (ADR spike S2). */
  detectLanguage(req: { segmentPath: string }): Promise<DetectedLanguage>;
}
