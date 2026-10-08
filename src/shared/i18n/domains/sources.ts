import type { Widen } from "../translate";

// 123 — khoá dịch domain "sources" (cột Nguồn, thêm nguồn, trạng thái, xử lý lại, chọn lại tệp gốc).
// error.<code>: nhãn lỗi nguồn theo SourceErrorCode (src/shared/codes/source-error.ts) — main lưu/gửi MÃ.

export const sourcesVi = {
  error: {
    extract: "Lỗi trích xuất",
    embed: "Lỗi nhúng",
    store: "Lỗi lưu trữ",
    generic: "Lỗi",
    fetch: "Lỗi tải trang",
    tooLarge: "Tệp quá lớn",
    interrupted: "Gián đoạn khi nạp — thử lại",
    reprocessFailed: "Xử lý lại thất bại — vẫn dùng bản cũ.",
    reprocessChanged:
      "Tệp gốc đã bị sửa so với lúc nạp — xử lý lại bị huỷ, vẫn dùng bản cũ.",
    reprocessVaultLocked:
      "Đang sao lưu/khôi phục — thử lại sau giây lát. Xử lý lại bị huỷ, vẫn dùng bản cũ.",
    unknown: "Lỗi không xác định",
  },
} as const;

export const sourcesEn: Widen<typeof sourcesVi> = {
  error: {
    extract: "Extraction failed",
    embed: "Embedding failed",
    store: "Storage failed",
    generic: "Error",
    fetch: "Couldn't load the page",
    tooLarge: "File too large",
    interrupted: "Interrupted while importing — retry",
    reprocessFailed: "Reprocessing failed — still using the previous version.",
    reprocessChanged:
      "The original file has changed since it was imported — reprocessing cancelled, still using the previous version.",
    reprocessVaultLocked:
      "A backup or restore is in progress — try again in a moment. Reprocessing cancelled, still using the previous version.",
    unknown: "Unknown error",
  },
};
