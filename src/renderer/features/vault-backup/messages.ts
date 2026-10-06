import type {
  VaultBackupErrorCode,
  VaultBackupState,
  VaultBackupStep,
} from "@shared/ipc/types";

// Văn phong UI tiếng Việt cho sao lưu/khôi phục (085). Thuần — unit-test được.

const ERRORS: Record<VaultBackupErrorCode, string> = {
  busy: "Đang bận xử lý — thử lại khi xong.",
  passwordTooShort: "Mật khẩu cần tối thiểu 8 ký tự.",
  notBackup: "Không phải file sao lưu InsightVault.",
  unsupportedFormat:
    "File sao lưu dùng định dạng mà phiên bản này chưa hỗ trợ — hãy cập nhật InsightVault.",
  badPasswordOrCorrupt: "Sai mật khẩu hoặc file sao lưu bị hỏng.",
  passwordRequired: "File sao lưu này được bảo vệ bằng mật khẩu.",
  newerSchema:
    "Bản sao lưu được tạo từ phiên bản InsightVault mới hơn — hãy cập nhật ứng dụng rồi thử lại.",
  diskFull: "Ổ đĩa không đủ dung lượng trống.",
  tokenInvalid: "Phiên khôi phục đã hết hạn — hãy chọn lại file.",
  ioError: "Không đọc/ghi được file. Kiểm tra quyền truy cập hoặc vị trí lưu.",
};

const STEPS: Record<VaultBackupStep, string> = {
  snapshot: "Đang chụp dữ liệu…",
  pack: "Đang nén và ghi file…",
  decrypt: "Đang giải mã và giải nén…",
  verify: "Đang kiểm tra dữ liệu…",
  preBackup: "Đang sao lưu vault hiện tại…",
};

const BUSY: Record<NonNullable<VaultBackupState["reason"]>, string> = {
  processing: "Đang xử lý nguồn…",
  reindexing: "Đang tái lập chỉ mục…",
  operation: "Đang sao lưu/khôi phục…",
};

export const errorMessage = (code: VaultBackupErrorCode): string =>
  ERRORS[code] ?? ERRORS.ioError;

export const stepLabel = (step: VaultBackupStep): string => STEPS[step];

export const busyReasonLabel = (reason: VaultBackupState["reason"]): string =>
  reason ? BUSY[reason] : "";
