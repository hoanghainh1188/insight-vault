import { describe, expect, it } from "vitest";
import {
  REPROCESS_ERRORS,
  checkReprocessable,
} from "../../src/main/services/ingestion/reprocess-guard";
import type { Source } from "../../src/shared/ipc/types";

// 112 (FR-012, FR-014; contracts/ipc-reprocess.md): ai được "Xử lý lại" — hàm thuần trả thông điệp lỗi hoặc null.

const src = (over: Partial<Source> = {}): Source => ({
  id: "s1",
  notebookId: "nb1",
  kind: "pdf",
  title: "a.pdf",
  status: "ready",
  errorCode: null,
  pageCount: 1,
  createdAt: 1,
  updatedAt: 1,
  extractionVersion: 1,
  ...over,
});
const ok = { queued: false, vaultLocked: false };

describe("checkReprocessable", () => {
  it("PDF ready / error, không bận ⇒ null (cho phép)", () => {
    expect(checkReprocessable(src(), ok)).toBeNull();
    expect(checkReprocessable(src({ status: "error" }), ok)).toBeNull();
  });

  it("đã ở phiên bản mới vẫn cho xử lý lại (người dùng chủ động)", () => {
    expect(checkReprocessable(src({ extractionVersion: 2 }), ok)).toBeNull();
  });

  it("vault đang khoá ⇒ lỗi khoá (ưu tiên trước mọi kiểm tra khác)", () => {
    expect(checkReprocessable(null, { queued: false, vaultLocked: true })).toBe(
      REPROCESS_ERRORS.vaultLocked,
    );
  });

  it("không tồn tại / không phải PDF / đang trong hàng đợi / trạng thái khác", () => {
    expect(checkReprocessable(null, ok)).toBe(REPROCESS_ERRORS.notFound);
    expect(checkReprocessable(src({ kind: "docx" }), ok)).toBe(
      REPROCESS_ERRORS.notPdf,
    );
    expect(checkReprocessable(src(), { ...ok, queued: true })).toBe(
      REPROCESS_ERRORS.busy,
    );
    for (const status of [
      "queued",
      "processing",
      "awaiting_embedding",
    ] as const) {
      expect(checkReprocessable(src({ status }), ok)).toBe(
        REPROCESS_ERRORS.badStatus,
      );
    }
  });

  it("thông điệp đúng contract", () => {
    // 123: mã lỗi người-dùng-thấy (giao diện dịch), không còn văn bản tiếng Việt.
    expect(REPROCESS_ERRORS).toEqual({
      vaultLocked: "vaultLocked",
      notFound: "sourceNotFound",
      notPdf: "reprocessNotPdf",
      busy: "reprocessBusy",
      badStatus: "reprocessBadStatus",
    });
  });
});
