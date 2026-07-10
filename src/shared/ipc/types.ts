// Kiểu trao đổi qua IPC (main ↔ renderer). Nguồn: data-model.md.

/** Trạng thái riêng tư — nguồn sự thật cho privacy indicator badge. v1 luôn 'local'. */
export interface PrivacyState {
  mode: "local" | "online";
  /** Văn bản hiển thị badge, suy ra từ mode (không hard-code rời rạc ở renderer). */
  label: string;
}

/** Trạng thái onboarding lần đầu. Lưu bền ở OS settings store. */
export interface OnboardingState {
  completed: boolean;
}

/** Thông tin tĩnh của app cho header/titlebar. */
export interface AppInfo {
  name: string;
  version: string;
}

/** Kết quả đảm bảo thư mục dữ liệu cục bộ tồn tại. */
export interface DataDirInfo {
  path: string;
  ready: boolean;
}
