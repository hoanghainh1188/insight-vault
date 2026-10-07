// 116 — hằng số bảo trì kho vector (research R10, ADR 2026-10-07-vector-maintenance). Đặt tên tường minh, không
// dựa giá trị mặc định của thư viện.

/** Kho phải yên (không ghi) chừng này sau lần ghi cuối mới kiểm bảo trì (clarify #1). */
export const DEBOUNCE_MS = 60_000;
/** Lần bắt kịp sau khởi động — trễ để không tranh tài nguyên lúc mở cửa sổ (clarify #1). */
export const STARTUP_DELAY_MS = 45_000;
/** Trần tần suất: không bắt đầu quá 1 lần bảo trì trong khoảng này (clarify #1). */
export const MIN_INTERVAL_MS = 600_000;
/** Biên an toàn: chỉ dọn phiên bản cũ hơn khoảng này (`cleanupOlderThan`, clarify #3). */
export const RETENTION_MS = 600_000;
/** Lần gộp vừa xong ⇒ kiểm lại sau biên để dọn phiên bản cũ, thu hồi dung lượng (research R2). */
export const FOLLOW_UP_MS = RETENTION_MS + 60_000;
/** Gộp khi số fragment ≥ ngưỡng — dưới mức này độ trễ tìm kiếm gần như không đổi (research R3). */
export const FRAGMENT_THRESHOLD = 64;
/** Dọn khi số phiên bản cũ hơn biên ≥ ngưỡng (research R3). */
export const PRUNABLE_VERSIONS_THRESHOLD = 20;
/** Cần dung lượng trống ≥ hệ số × kích thước `vectors/` (gộp ghi tệp mới trước khi dọn — clarify #8, R2). */
export const FREE_SPACE_FACTOR = 2;
/** Lỗi liên tiếp tối đa trước khi ngưng tới lần khởi động sau (clarify #5). */
export const MAX_CONSECUTIVE_FAILURES = 3;
/** Backoff sau lỗi thứ n = BACKOFF_BASE_MS × 2^(n−1) (clarify #5). */
export const BACKOFF_BASE_MS = 600_000;
/** Sao lưu chờ bảo trì đang chạy xong tối đa chừng này, quá ⇒ báo bận (research R7). */
export const BACKUP_WAIT_TIMEOUT_MS = 120_000;
