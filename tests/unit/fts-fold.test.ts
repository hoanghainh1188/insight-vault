import { describe, it, expect } from "vitest";
import {
  foldVietnamese,
  buildFtsMatch,
} from "../../src/main/services/ingestion/fts-fold";

describe("foldVietnamese (055)", () => {
  it("bỏ dấu thanh + đ→d + lowercase", () => {
    expect(foldVietnamese("Hợp Đồng Lao Động")).toBe("hop dong lao dong");
    expect(foldVietnamese("Điều 47")).toBe("dieu 47");
    expect(foldVietnamese("Nghị định 13/2023")).toBe("nghi dinh 13/2023");
  });
  it("giữ số + ký tự thường", () => {
    expect(foldVietnamese("ABC123")).toBe("abc123");
  });
});

describe("buildFtsMatch (055)", () => {
  it("token OR, mỗi token trong nháy kép", () => {
    expect(buildFtsMatch("hợp đồng")).toBe('"hop" OR "dong"');
  });
  it("gõ không dấu ra cùng match với có dấu", () => {
    expect(buildFtsMatch("hop dong")).toBe(buildFtsMatch("hợp đồng"));
  });
  it("ký tự đặc biệt FTS không phá cú pháp (escape/loại)", () => {
    // Toán tử/ngoặc bị loại khi tách token; token bọc nháy.
    const m = buildFtsMatch("điều 47 AND (x) *");
    expect(m).toContain('"dieu"');
    expect(m).toContain('"47"');
    expect(m).toContain('"and"'); // 'AND' fold thành token thường, không còn là toán tử
    expect(m).not.toContain("*");
    expect(m).not.toContain("(");
  });
  it("query rỗng/chỉ ký tự đặc biệt → ''", () => {
    expect(buildFtsMatch("   ")).toBe("");
    expect(buildFtsMatch("*()")).toBe("");
  });
});
