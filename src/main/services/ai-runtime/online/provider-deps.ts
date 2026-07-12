// Deps inject cho mỗi provider online (031). Tách riêng để 3 provider + test dùng chung.
// getKey đọc từ keytar (async); getModel đọc từ online-config; fetchFn tiêm để test không gọi mạng thật.

export interface OnlineProviderDeps {
  /** Đọc API key từ keychain (null nếu chưa nhập). */
  getKey: () => Promise<string | null>;
  /** Model đang chọn cho provider này (null nếu chưa chọn). */
  getModel: () => string | null;
  /** fetch tiêm vào (test dùng fake). */
  fetchFn: typeof fetch;
  /** Timeout HTTP (mặc định 60s ở online-http). */
  timeoutMs?: number;
}
