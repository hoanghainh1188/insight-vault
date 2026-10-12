import { describe, it, expect } from "vitest";
import {
  segmentFileName,
  segmentShouldRotate,
  segmentOffsets,
  totalDurationSec,
  locateInSegments,
  playbackTarget,
  toSegmentInfo,
  type CaptureSegment,
} from "../../src/main/services/meeting-capture/segments";

// 186 — phân đoạn ghi âm (R3, R10): tên tệp, xoay, offset thời gian audio, định vị khi phát lại. Hàm thuần.

const RATE = 16000;
const seg = (
  index: number,
  seconds: number,
  closed = true,
): CaptureSegment => ({
  index,
  file: segmentFileName(index),
  samples: seconds * RATE,
  closed,
});

describe("segmentFileName", () => {
  it("seg-NNNN.wav đệm 4 chữ số", () => {
    expect(segmentFileName(0)).toBe("seg-0000.wav");
    expect(segmentFileName(23)).toBe("seg-0023.wav");
    expect(segmentFileName(12345)).toBe("seg-12345.wav");
  });
});

describe("segmentShouldRotate", () => {
  it("xoay khi đủ giới hạn mẫu", () => {
    expect(segmentShouldRotate(4_799_999, 4_800_000)).toBe(false);
    expect(segmentShouldRotate(4_800_000, 4_800_000)).toBe(true);
    expect(segmentShouldRotate(5_000_000, 4_800_000)).toBe(true);
  });
});

describe("offset & thời lượng (thời gian audio, không tính tạm dừng)", () => {
  const segs = [seg(0, 300), seg(1, 120), seg(2, 300), seg(3, 42, false)];

  it("segmentOffsets = tổng thời lượng các phân đoạn trước", () => {
    expect(segmentOffsets(segs, RATE)).toEqual([0, 300, 420, 720]);
  });

  it("totalDurationSec gồm cả phân đoạn đang mở", () => {
    expect(totalDurationSec(segs, RATE)).toBe(762);
    expect(totalDurationSec([], RATE)).toBe(0);
  });

  it("toSegmentInfo cho MeetingState", () => {
    expect(toSegmentInfo(segs.slice(0, 2), RATE)).toEqual([
      { index: 0, durationSec: 300, closed: true },
      { index: 1, durationSec: 120, closed: true },
    ]);
  });
});

describe("locateInSegments", () => {
  const segs = [seg(0, 300), seg(1, 120), seg(2, 60, false)];

  it("định vị đúng phân đoạn + offset", () => {
    expect(locateInSegments(segs, 0, RATE)).toEqual({ index: 0, offsetSec: 0 });
    expect(locateInSegments(segs, 299.5, RATE)).toEqual({
      index: 0,
      offsetSec: 299.5,
    });
    expect(locateInSegments(segs, 300, RATE)).toEqual({
      index: 1,
      offsetSec: 0,
    });
    expect(locateInSegments(segs, 450, RATE)).toEqual({
      index: 2,
      offsetSec: 30,
    });
  });

  it("đúng cuối ⇒ phân đoạn cuối; ngoài phạm vi / âm / NaN ⇒ null", () => {
    expect(locateInSegments(segs, 480, RATE)).toEqual({
      index: 2,
      offsetSec: 60,
    });
    expect(locateInSegments(segs, 481, RATE)).toBeNull();
    expect(locateInSegments(segs, -1, RATE)).toBeNull();
    expect(locateInSegments(segs, Number.NaN, RATE)).toBeNull();
    expect(locateInSegments([], 0, RATE)).toBeNull();
  });
});

describe("playbackTarget", () => {
  const segs = [seg(0, 300), seg(1, 60, false)];

  it("đã ghép ⇒ luôn tệp ghép", () => {
    expect(playbackTarget(segs, true, undefined)).toEqual({ kind: "merged" });
    expect(playbackTarget(segs, true, 1)).toEqual({ kind: "merged" });
  });

  it("chưa ghép ⇒ phân đoạn yêu cầu (mặc định 0)", () => {
    expect(playbackTarget(segs, false, undefined)).toEqual({
      kind: "segment",
      index: 0,
    });
    expect(playbackTarget(segs, false, 1)).toEqual({
      kind: "segment",
      index: 1,
    });
  });

  it("phân đoạn không tồn tại / chỉ số lạ ⇒ null", () => {
    expect(playbackTarget(segs, false, 2)).toBeNull();
    expect(playbackTarget(segs, false, -1)).toBeNull();
    expect(playbackTarget(segs, false, 0.5)).toBeNull();
    expect(playbackTarget([], false, undefined)).toBeNull();
  });
});
