import { describe, it, expect } from "vitest";
import { expandGroupedCitations } from "../../src/shared/citations/expand-grouped";

// #129: model hay viết trích dẫn gộp "[1, 2]" / "[1-3]" — tách thành chip đơn "[1] [2]" để hậu kiểm + hiển thị chip.

describe("expandGroupedCitations", () => {
  it("danh sách phẩy/chấm phẩy ⇒ chip đơn cách nhau 1 khoảng trắng", () => {
    expect(expandGroupedCitations("star anise [1, 2].")).toBe(
      "star anise [1] [2].",
    );
    expect(expandGroupedCitations("a [1,2,3] b")).toBe("a [1] [2] [3] b");
    expect(expandGroupedCitations("a [4; 6]")).toBe("a [4] [6]");
  });

  it("khoảng nhỏ n-m / n–m ⇒ liệt kê", () => {
    expect(expandGroupedCitations("x [2-4]")).toBe("x [2] [3] [4]");
    expect(expandGroupedCitations("x [2–3]")).toBe("x [2] [3]");
  });

  it("giữ nguyên: [n] đơn, khoảng ngược/quá rộng, số quá dài, chữ trong ngoặc", () => {
    for (const s of [
      "theo [1].",
      "x [5-2]",
      "x [1-50]",
      "x [1, 1234567]",
      "[a, b]",
      "[1, ]",
      "mảng [1, 2",
    ]) {
      expect(expandGroupedCitations(s), s).toBe(s);
    }
  });

  it("bỏ số trùng trong nhóm", () => {
    expect(expandGroupedCitations("[1, 1, 2]")).toBe("[1] [2]");
  });
});
