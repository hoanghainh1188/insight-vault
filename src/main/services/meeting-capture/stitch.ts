import type { Segment } from "../ingestion/audio/audio-transcript";

// 186 — ghép kết quả ASR chốt giữa các phân đoạn (R8, D5). THUẦN, thời gian audio TUYỆT ĐỐI.
// Phân đoạn i>0 được nhận dạng kèm `overlapSec` cuối phân đoạn trước (ngữ cảnh). Vùng chồng lấn chia đôi tại
// cut_i = start_i − overlap/2: segment thuộc phân đoạn i khi điểm giữa ∈ [cut_i, cut_{i+1}).

export interface CaptureSegmentResult {
  /** Giây bắt đầu của phân đoạn trên trục thời gian audio. */
  startSec: number;
  /** Segment đã quy về thời gian tuyệt đối. */
  segments: readonly Segment[];
}

export function shiftTranscriptSegments(
  segments: readonly Segment[],
  deltaSec: number,
): Segment[] {
  return segments.map((s) => ({
    text: s.text,
    tStart: s.tStart + deltaSec,
    tEnd: s.tEnd + deltaSec,
  }));
}

export function stitchTranscriptSegments(
  results: readonly CaptureSegmentResult[],
  overlapSec: number,
): Segment[] {
  const sorted = [...results].sort((a, b) => a.startSec - b.startSec);
  const half = Math.max(0, overlapSec) / 2;
  const cuts = sorted.map((r, i) =>
    i === 0 ? Number.NEGATIVE_INFINITY : r.startSec - half,
  );
  const out: Segment[] = [];
  sorted.forEach((r, i) => {
    const lo = cuts[i] ?? Number.NEGATIVE_INFINITY;
    const hi = cuts[i + 1] ?? Number.POSITIVE_INFINITY;
    for (const s of r.segments) {
      const mid = (s.tStart + s.tEnd) / 2;
      if (mid >= lo && mid < hi)
        out.push({ text: s.text, tStart: s.tStart, tEnd: s.tEnd });
    }
  });
  return out.sort((a, b) => a.tStart - b.tStart);
}
