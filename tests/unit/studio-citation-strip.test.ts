import { describe, it, expect } from "vitest";
import { stripCitationMarkers } from "../../src/renderer/features/studio/citation-strip";

// 178 (PR 4, FR-043, clarify #5): chữ tạm khi stream — gỡ mọi dấu [n] (chưa hậu kiểm, không chip, không số thô), kể cả mẩu
// chưa đóng ở CUỐI buffer (token tới dở dang).

describe("stripCitationMarkers", () => {
  it.each([
    ["Câu một [1].", "Câu một."],
    ["Câu [1, 2] hai.", "Câu hai."],
    ["Câu [1-3] ba.", "Câu ba."],
    ["Câu [1–3] ba.", "Câu ba."],
    ["Câu [12][3] bốn.", "Câu bốn."],
    ["A [1], B [2]; C [3]!", "A, B; C!"],
    ["- Ý chính [4]\n- Ý khác [5]", "- Ý chính\n- Ý khác"],
  ])("gỡ chip: %j", (input, out) => {
    expect(stripCitationMarkers(input)).toBe(out);
  });

  it.each([
    ["Mảng [abc] giữ.", "Mảng [abc] giữ."],
    ["Rỗng [ ] giữ.", "Rỗng [ ] giữ."],
    ["Link [x](y)", "Link [x](y)"],
  ])("giữ ngoặc không phải số: %j", (input, out) => {
    expect(stripCitationMarkers(input)).toBe(out);
  });

  it.each([
    ["…câu [1", "…câu"],
    ["…câu [", "…câu"],
    ["…câu [1, ", "…câu"],
    ["…câu [12-", "…câu"],
  ])("gỡ mẩu chưa đóng ở cuối: %j", (input, out) => {
    expect(stripCitationMarkers(input)).toBe(out);
  });

  it("không gỡ '[' giữa văn bản khi phía sau đã có ']'", () => {
    expect(stripCitationMarkers("Xem [ghi chú] rồi [abc")).toBe(
      "Xem [ghi chú] rồi [abc",
    );
    expect(stripCitationMarkers("a [b] c")).toBe("a [b] c");
  });

  it("giữ xuống dòng / thụt lề markdown", () => {
    expect(stripCitationMarkers("## Tiêu đề\n\n  - mục [1]\n")).toBe(
      "## Tiêu đề\n\n  - mục\n",
    );
  });

  it("chuỗi rỗng ⇒ rỗng", () => {
    expect(stripCitationMarkers("")).toBe("");
  });
});

describe("stripCitationMarkers — hiệu năng (security M1)", () => {
  it.each([
    ["100 KB khoảng trắng", " ".repeat(100_000)],
    ["khoảng trắng rồi chữ", " ".repeat(100_000) + "x"],
    ["khoảng trắng rồi [ chưa đóng", "a" + " \t".repeat(50_000) + "[1"],
    ["nhiều '[' + khoảng trắng", "[ ".repeat(50_000)],
    ["[1 + khoảng trắng không đóng", "[1" + " ".repeat(100_000)],
  ])("%s ⇒ tuyến tính (< 50 ms)", (_l, input) => {
    const t0 = performance.now();
    stripCitationMarkers(input);
    expect(performance.now() - t0).toBeLessThan(50);
  });

  it("vẫn gỡ khoảng trắng trước chip sau khi bỏ regex dẫn đầu", () => {
    expect(stripCitationMarkers("a \t [1] [2].")).toBe("a.");
    expect(stripCitationMarkers("a  [1")).toBe("a");
  });
});
