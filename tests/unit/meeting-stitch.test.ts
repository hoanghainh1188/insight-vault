import { describe, it, expect } from "vitest";
import {
  shiftTranscriptSegments,
  stitchTranscriptSegments,
} from "../../src/main/services/meeting-capture/stitch";

// 186 — ghép kết quả ASR chốt giữa các phân đoạn (R8): mỗi phân đoạn i>0 được nhận dạng kèm 5 s cuối phân đoạn
// trước; vùng chồng lấn chia đôi theo điểm giữa segment. Hàm thuần, thời gian audio tuyệt đối.

const s = (text: string, tStart: number, tEnd: number) => ({
  text,
  tStart,
  tEnd,
});

describe("shiftTranscriptSegments", () => {
  it("cộng delta vào tStart/tEnd, không mutate", () => {
    const input = [s("a", 0, 2)];
    expect(shiftTranscriptSegments(input, 295)).toEqual([s("a", 295, 297)]);
    expect(input[0]).toEqual(s("a", 0, 2));
  });
});

describe("stitchTranscriptSegments", () => {
  it("phân đoạn đầu không có vùng chồng lấn ⇒ giữ nguyên", () => {
    const out = stitchTranscriptSegments(
      [{ startSec: 0, segments: [s("một", 0, 3), s("hai", 3, 6)] }],
      5,
    );
    expect(out).toEqual([s("một", 0, 3), s("hai", 3, 6)]);
  });

  it("chia vùng chồng lấn tại start − overlap/2: không mất, không lặp", () => {
    // Phân đoạn 0: 0..300. Phân đoạn 1 bắt đầu 300, được nhận dạng từ 295 (5 s ngữ cảnh).
    const prev = [s("đầu", 0, 290), s("câu bị cắt", 296, 300)]; // mid 298 ≥ 297.5 ⇒ nhường phân đoạn sau
    const curr = [s("câu bị cắt đầy đủ", 296, 303), s("tiếp", 303, 310)]; // mid 299.5 ≥ 297.5 ⇒ giữ
    const out = stitchTranscriptSegments(
      [
        { startSec: 0, segments: prev },
        { startSec: 300, segments: curr },
      ],
      5,
    );
    expect(out.map((x) => x.text)).toEqual([
      "đầu",
      "câu bị cắt đầy đủ",
      "tiếp",
    ]);
  });

  it("segment của phân đoạn sau nằm trọn trong nửa đầu vùng chồng lấn ⇒ bỏ (đã có ở phân đoạn trước)", () => {
    const prev = [s("cuối phân đoạn trước", 293, 297)]; // mid 295 < 297.5 ⇒ giữ
    const curr = [s("cuối phân đoạn trước", 295, 297), s("mới", 300, 304)]; // mid 296 < 297.5 ⇒ bỏ
    const out = stitchTranscriptSegments(
      [
        { startSec: 0, segments: prev },
        { startSec: 300, segments: curr },
      ],
      5,
    );
    expect(out.map((x) => x.text)).toEqual(["cuối phân đoạn trước", "mới"]);
  });

  it("nhiều phân đoạn, kết quả sắp theo tStart", () => {
    const out = stitchTranscriptSegments(
      [
        { startSec: 0, segments: [s("a", 0, 5)] },
        { startSec: 300, segments: [s("b", 301, 305)] },
        { startSec: 420, segments: [s("c", 421, 425)] },
      ],
      5,
    );
    expect(out.map((x) => x.text)).toEqual(["a", "b", "c"]);
  });

  it("overlap 0 ⇒ chỉ cắt tại start", () => {
    const out = stitchTranscriptSegments(
      [
        { startSec: 0, segments: [s("a", 0, 10)] },
        { startSec: 10, segments: [s("b", 10, 12)] },
      ],
      0,
    );
    expect(out.map((x) => x.text)).toEqual(["a", "b"]);
  });
});
