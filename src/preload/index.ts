import { contextBridge, ipcRenderer } from "electron";
import { CHANNELS } from "@shared/ipc/channels";
import type {
  AppInfo,
  DataDirInfo,
  Model,
  ModelSelection,
  OnboardingState,
  RuntimeStatus,
} from "@shared/ipc/types";

/**
 * Cầu nối an toàn (Constitution III / US2, US4): expose MỖI kênh là MỘT HÀM RIÊNG.
 * KHÔNG expose `invoke(channel, …)` chung ⇒ renderer không thể gọi tên kênh tuỳ ý.
 */
const api = {
  // app-shell (001)
  getDataDir: (): Promise<DataDirInfo> =>
    ipcRenderer.invoke(CHANNELS.getDataDir),
  getPrivacyState: (): Promise<import("@shared/ipc/types").PrivacyState> =>
    ipcRenderer.invoke(CHANNELS.getPrivacyState),
  getOnboardingState: (): Promise<OnboardingState> =>
    ipcRenderer.invoke(CHANNELS.getOnboardingState),
  setOnboardingComplete: (): Promise<{ completed: true }> =>
    ipcRenderer.invoke(CHANNELS.setOnboardingComplete),
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(CHANNELS.getAppInfo),
  // ai-runtime (007)
  aiListModels: (): Promise<Model[]> =>
    ipcRenderer.invoke(CHANNELS.aiListModels),
  aiTestConnection: (): Promise<RuntimeStatus> =>
    ipcRenderer.invoke(CHANNELS.aiTestConnection),
  aiGetSelectedModels: (): Promise<ModelSelection> =>
    ipcRenderer.invoke(CHANNELS.aiGetSelectedModels),
  aiSetSelectedModels: (sel: ModelSelection): Promise<ModelSelection> =>
    ipcRenderer.invoke(CHANNELS.aiSetSelectedModels, sel),
  aiGetRuntimeStatus: (): Promise<RuntimeStatus> =>
    ipcRenderer.invoke(CHANNELS.aiGetRuntimeStatus),
};

export type Api = typeof api;

contextBridge.exposeInMainWorld("api", api);
