import { describe, it, expect } from "vitest";
import { dedupeHallucination } from "../../src/main/services/meeting-capture/hallucination";

// 186 PR B (R6) — khử ảo giác Whisper: bỏ segment rỗng/chỉ dấu câu, gộp cụm lặp ≥ 3 lần liên tiếp, giữ lặp 2 lần. THUẦN.

const seg = (text: string, tStart: number, tEnd = tStart + 2) => ({
  text,
  tStart,
  tEnd,
});

describe("dedupeHallucination", () => {
  it("bỏ segment rỗng / chỉ khoảng trắng / chỉ dấu câu, ký hiệu", () => {
    expect(
      dedupeHallucination([
        seg("  ", 0),
        seg("...", 2),
        seg(" ♪ ", 4),
        seg("Xin chào.", 6),
      ]),
    ).toEqual([seg("Xin chào.", 6)]);
  });

  it("≥ 3 segment liên tiếp cùng nội dung (bỏ qua hoa/thường, dấu câu) ⇒ giữ một, kéo dài tới cuối", () => {
    expect(
      dedupeHallucination([
        seg("Cảm ơn các bạn đã xem.", 0, 2),
        seg("cảm ơn các bạn đã xem", 2, 4),
        seg("Cảm ơn các bạn đã xem!", 4, 6),
        seg("Tiếp theo.", 6, 8),
      ]),
    ).toEqual([seg("Cảm ơn các bạn đã xem.", 0, 6), seg("Tiếp theo.", 6, 8)]);
  });

  it("lặp 2 lần là hợp lệ ⇒ giữ nguyên", () => {
    const input = [seg("Đúng rồi.", 0), seg("Đúng rồi.", 2)];
    expect(dedupeHallucination(input)).toEqual(input);
  });

  it("cụm từ lặp ≥ 3 lần liên tiếp trong một segment ⇒ còn một lần", () => {
    expect(
      dedupeHallucination([seg("Vâng, vâng, vâng, vâng chúng ta bắt đầu", 0)]),
    ).toEqual([seg("Vâng, chúng ta bắt đầu", 0)]);
    expect(
      dedupeHallucination([
        seg("the meeting the meeting the meeting is over", 0),
      ]),
    ).toEqual([seg("the meeting is over", 0)]);
  });

  it("cụm lặp 2 lần trong segment ⇒ giữ", () => {
    expect(dedupeHallucination([seg("rất rất tốt", 0)])).toEqual([
      seg("rất rất tốt", 0),
    ]);
  });

  it("không mutate đầu vào", () => {
    const input = Object.freeze([
      Object.freeze(seg("a a a a", 0)),
    ]) as unknown as Parameters<typeof dedupeHallucination>[0];
    expect(() => dedupeHallucination(input)).not.toThrow();
  });
});
