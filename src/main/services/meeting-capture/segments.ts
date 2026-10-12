import type { CaptureSegmentInfo } from "@shared/ipc/types";

// 186 — phân đoạn ghi âm (CaptureSegment, R3/R10). THUẦN: tên tệp, xoay, offset trên trục thời gian audio, định vị phát lại.

/** Bản ghi một phân đoạn (lưu trong meeting_session.segments_json). `file` là tên tương đối trong thư mục phiên. */
export interface CaptureSegment {
  index: number;
  file: string;
  samples: number;
  closed: boolean;
}

export function segmentFileName(index: number): string {
  return `seg-${String(index).padStart(4, "0")}.wav`;
}

export function segmentShouldRotate(
  samplesInSegment: number,
  limitSamples: number,
): boolean {
  return samplesInSegment >= limitSamples;
}

/** Giây bắt đầu của từng phân đoạn trên trục thời gian audio. */
export function segmentOffsets(
  segments: readonly CaptureSegment[],
  sampleRate: number,
): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const s of segments) {
    out.push(acc / sampleRate);
    acc += s.samples;
  }
  return out;
}

export function totalDurationSec(
  segments: readonly CaptureSegment[],
  sampleRate: number,
): number {
  return segments.reduce((sum, s) => sum + s.samples, 0) / sampleRate;
}

export function toSegmentInfo(
  segments: readonly CaptureSegment[],
  sampleRate: number,
): CaptureSegmentInfo[] {
  return segments.map((s) => ({
    index: s.index,
    durationSec: s.samples / sampleRate,
    closed: s.closed,
  }));
}

/** Thời gian audio ⇒ (phân đoạn, offset trong phân đoạn). Ngoài phạm vi ⇒ null. */
export function locateInSegments(
  segments: readonly CaptureSegment[],
  tSec: number,
  sampleRate: number,
): { index: number; offsetSec: number } | null {
  if (!Number.isFinite(tSec) || tSec < 0 || segments.length === 0) return null;
  const offsets = segmentOffsets(segments, sampleRate);
  for (let i = segments.length - 1; i >= 0; i--) {
    const start = offsets[i] ?? 0;
    const end = start + (segments[i]?.samples ?? 0) / sampleRate;
    if (tSec >= start) {
      if (tSec > end) return null;
      return { index: segments[i]?.index ?? i, offsetSec: tSec - start };
    }
  }
  return null;
}

export type PlaybackTarget =
  { kind: "merged" } | { kind: "segment"; index: number };

/** Tệp nào phục vụ cho iv-media: đã ghép ⇒ meeting.wav; chưa ⇒ phân đoạn được yêu cầu (mặc định 0). */
export function playbackTarget(
  segments: readonly CaptureSegment[],
  mergedExists: boolean,
  requestedSeg: number | undefined,
): PlaybackTarget | null {
  if (mergedExists) return { kind: "merged" };
  const idx = requestedSeg ?? 0;
  if (!Number.isInteger(idx) || idx < 0) return null;
  return segments.some((s) => s.index === idx)
    ? { kind: "segment", index: idx }
    : null;
}
