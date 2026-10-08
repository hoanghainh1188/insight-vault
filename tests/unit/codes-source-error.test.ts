import { describe, it, expect } from "vitest";
import {
  LEGACY_SOURCE_ERROR_LABELS,
  SOURCE_ERROR_CODES,
  normalizeSourceErrorCode,
} from "../../src/shared/codes/source-error";

// 123 (FR-014, data-model.md): nhãn lỗi nguồn lưu/truyền bằng MÃ; văn bản Việt cũ ⇒ mã; lạ ⇒ unknown.

describe("normalizeSourceErrorCode", () => {
  it("11 mã hợp lệ giữ nguyên", () => {
    expect(SOURCE_ERROR_CODES).toHaveLength(11);
    for (const c of SOURCE_ERROR_CODES)
      expect(normalizeSourceErrorCode(c)).toBe(c);
  });

  it("văn bản Việt cũ ⇒ mã", () => {
    expect(normalizeSourceErrorCode("Lỗi trích xuất")).toBe("extract");
    expect(normalizeSourceErrorCode("Lỗi nhúng")).toBe("embed");
    expect(normalizeSourceErrorCode("Lỗi lưu trữ")).toBe("store");
    expect(normalizeSourceErrorCode("Lỗi")).toBe("generic");
    expect(normalizeSourceErrorCode("Lỗi tải trang")).toBe("fetch");
    expect(normalizeSourceErrorCode("Tệp quá lớn")).toBe("tooLarge");
    expect(normalizeSourceErrorCode("Gián đoạn khi nạp — thử lại")).toBe(
      "interrupted",
    );
    expect(
      normalizeSourceErrorCode("Xử lý lại thất bại — vẫn dùng bản cũ."),
    ).toBe("reprocessFailed");
    expect(
      normalizeSourceErrorCode(
        "Tệp gốc đã bị sửa so với lúc nạp — xử lý lại bị huỷ, vẫn dùng bản cũ.",
      ),
    ).toBe("reprocessChanged");
    expect(
      normalizeSourceErrorCode(
        "Đang sao lưu/khôi phục — thử lại sau giây lát. Xử lý lại bị huỷ, vẫn dùng bản cũ.",
      ),
    ).toBe("reprocessVaultLocked");
  });

  it("null / rỗng ⇒ null; giá trị lạ ⇒ unknown", () => {
    expect(normalizeSourceErrorCode(null)).toBeNull();
    expect(normalizeSourceErrorCode(undefined)).toBeNull();
    expect(normalizeSourceErrorCode("")).toBeNull();
    expect(normalizeSourceErrorCode("Lỗi gì đó lạ")).toBe("unknown");
    expect(normalizeSourceErrorCode("EXTRACT")).toBe("unknown");
  });

  it("bảng ánh xạ cũ đủ 10 mục, mọi đích là mã hợp lệ", () => {
    const entries = Object.entries(LEGACY_SOURCE_ERROR_LABELS);
    expect(entries).toHaveLength(10);
    for (const [, code] of entries) expect(SOURCE_ERROR_CODES).toContain(code);
  });
});
