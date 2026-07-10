import type {
  AppInfo,
  DataDirInfo,
  OnboardingState,
  PrivacyState,
} from "./types";

/**
 * Whitelist đầy đủ 5 kênh IPC ở app-shell (Constitution III, clarify A4).
 * Đây là NGUỒN DUY NHẤT: main (register) + preload (expose) đều tham chiếu.
 * Feature sau THÊM kênh mới ở đây — không đổi nghĩa 5 kênh này.
 */
export const CHANNELS = {
  getDataDir: "app:getDataDir",
  getPrivacyState: "app:getPrivacyState",
  getOnboardingState: "app:getOnboardingState",
  setOnboardingComplete: "app:setOnboardingComplete",
  getAppInfo: "app:getAppInfo",
} as const;

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];

/** Tập tên kênh whitelisted (dùng cho guard ở main). */
export const WHITELISTED_CHANNELS: ReadonlySet<string> = new Set(
  Object.values(CHANNELS),
);

/** Guard thuần — kiểm 1 tên kênh có thuộc whitelist không (unit-test được, không cần electron). */
export function isWhitelisted(channel: string): channel is ChannelName {
  return WHITELISTED_CHANNELS.has(channel);
}

/** Bản đồ kiểu response theo kênh — dùng cho type-safety ở preload/renderer. */
export interface ChannelResponse {
  [CHANNELS.getDataDir]: DataDirInfo;
  [CHANNELS.getPrivacyState]: PrivacyState;
  [CHANNELS.getOnboardingState]: OnboardingState;
  [CHANNELS.setOnboardingComplete]: { completed: true };
  [CHANNELS.getAppInfo]: AppInfo;
}
