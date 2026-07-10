import { contextBridge, ipcRenderer } from "electron";
import { CHANNELS } from "@shared/ipc/channels";
import type { AppInfo, DataDirInfo, OnboardingState } from "@shared/ipc/types";

/**
 * Cầu nối an toàn (Constitution III / US2): expose MỖI kênh là MỘT HÀM RIÊNG.
 * KHÔNG expose `invoke(channel, …)` chung ⇒ renderer không thể gọi tên kênh tuỳ ý.
 */
const api = {
  getDataDir: (): Promise<DataDirInfo> =>
    ipcRenderer.invoke(CHANNELS.getDataDir),
  getPrivacyState: (): Promise<import("@shared/ipc/types").PrivacyState> =>
    ipcRenderer.invoke(CHANNELS.getPrivacyState),
  getOnboardingState: (): Promise<OnboardingState> =>
    ipcRenderer.invoke(CHANNELS.getOnboardingState),
  setOnboardingComplete: (): Promise<{ completed: true }> =>
    ipcRenderer.invoke(CHANNELS.setOnboardingComplete),
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(CHANNELS.getAppInfo),
};

export type Api = typeof api;

contextBridge.exposeInMainWorld("api", api);
