import { contextBridge, ipcRenderer } from "electron";
import { CHANNELS } from "@shared/ipc/channels";
import type {
  AppInfo,
  CreateNotebookInput,
  DataDirInfo,
  Model,
  ModelSelection,
  Notebook,
  OnboardingState,
  RenameNotebookInput,
  RuntimeStatus,
  SetColorInput,
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
  // notebooks (009)
  notebookList: (): Promise<Notebook[]> =>
    ipcRenderer.invoke(CHANNELS.notebookList),
  notebookCreate: (input: CreateNotebookInput): Promise<Notebook> =>
    ipcRenderer.invoke(CHANNELS.notebookCreate, input),
  notebookRename: (input: RenameNotebookInput): Promise<Notebook> =>
    ipcRenderer.invoke(CHANNELS.notebookRename, input),
  notebookSetColor: (input: SetColorInput): Promise<Notebook> =>
    ipcRenderer.invoke(CHANNELS.notebookSetColor, input),
  notebookDelete: (id: string): Promise<{ deleted: true }> =>
    ipcRenderer.invoke(CHANNELS.notebookDelete, id),
};

export type Api = typeof api;

contextBridge.exposeInMainWorld("api", api);
