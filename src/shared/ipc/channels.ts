import type {
  AppInfo,
  DataDirInfo,
  Model,
  ModelSelection,
  Notebook,
  OnboardingState,
  PrivacyState,
  RuntimeStatus,
} from "./types";

/**
 * Whitelist đầy đủ các kênh IPC (Constitution III). NGUỒN DUY NHẤT: main (register) + preload (expose).
 * Feature sau THÊM kênh mới ở đây — KHÔNG đổi nghĩa kênh cũ.
 * - app:*  → 001-app-shell (5 kênh)
 * - ai:*   → 007-ai-runtime (5 kênh)
 */
export const CHANNELS = {
  getDataDir: "app:getDataDir",
  getPrivacyState: "app:getPrivacyState",
  getOnboardingState: "app:getOnboardingState",
  setOnboardingComplete: "app:setOnboardingComplete",
  getAppInfo: "app:getAppInfo",
  // ai-runtime (007)
  aiListModels: "ai:listModels",
  aiTestConnection: "ai:testConnection",
  aiGetSelectedModels: "ai:getSelectedModels",
  aiSetSelectedModels: "ai:setSelectedModels",
  aiGetRuntimeStatus: "ai:getRuntimeStatus",
  // notebooks (009)
  notebookList: "notebook:list",
  notebookCreate: "notebook:create",
  notebookRename: "notebook:rename",
  notebookSetColor: "notebook:setColor",
  notebookDelete: "notebook:delete",
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
  [CHANNELS.aiListModels]: Model[];
  [CHANNELS.aiTestConnection]: RuntimeStatus;
  [CHANNELS.aiGetSelectedModels]: ModelSelection;
  [CHANNELS.aiSetSelectedModels]: ModelSelection;
  [CHANNELS.aiGetRuntimeStatus]: RuntimeStatus;
  [CHANNELS.notebookList]: Notebook[];
  [CHANNELS.notebookCreate]: Notebook;
  [CHANNELS.notebookRename]: Notebook;
  [CHANNELS.notebookSetColor]: Notebook;
  [CHANNELS.notebookDelete]: { deleted: true };
}
