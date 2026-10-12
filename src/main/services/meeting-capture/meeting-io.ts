import type { Segment } from "../ingestion/audio/audio-transcript";
import type { AsrErrorCode, AsrLanguage } from "./asr-protocol";
import type { CaptureSegment } from "./segments";

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
}

export interface AsrFinalClient {
  /** Segment trả về có thời gian TƯƠNG ĐỐI đầu phân đoạn hiện tại (vùng ngữ cảnh của phân đoạn trước có giá trị âm). */
  final(req: {
    segmentPath: string;
    prevSegmentPath?: string;
    overlapSec: number;
    language: AsrLanguage;
  }): Promise<Segment[]>;
}
