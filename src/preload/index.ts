import { contextBridge, ipcRenderer, webUtils } from "electron";
import { CHANNELS } from "@shared/ipc/channels";
import type {
  AddSourceInput,
  AddSourceResult,
  AppInfo,
  CreateNotebookInput,
  DataDirInfo,
  Model,
  ModelSelection,
  Notebook,
  OnboardingState,
  RagAnswer,
  RagAskInput,
  RenameNotebookInput,
  RuntimeStatus,
  SetColorInput,
  Source,
  SourceContent,
  SourceProgressEvent,
  StudioGenerateInput,
  StudioResult,
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
  // ingestion (011) — 5 hàm invoke + 1 subscribe event tiến độ.
  sourceAdd: (input: AddSourceInput): Promise<AddSourceResult> =>
    ipcRenderer.invoke(CHANNELS.sourceAdd, input),
  sourceListByNotebook: (notebookId: string): Promise<Source[]> =>
    ipcRenderer.invoke(CHANNELS.sourceListByNotebook, notebookId),
  sourceGet: (id: string): Promise<Source | null> =>
    ipcRenderer.invoke(CHANNELS.sourceGet, id),
  sourceDelete: (id: string): Promise<{ deleted: true }> =>
    ipcRenderer.invoke(CHANNELS.sourceDelete, id),
  sourceRetry: (id: string): Promise<Source> =>
    ipcRenderer.invoke(CHANNELS.sourceRetry, id),
  // source-viewer (019)
  sourceGetContent: (id: string): Promise<SourceContent | null> =>
    ipcRenderer.invoke(CHANNELS.sourceGetContent, id),
  /** Đăng ký nhận tiến độ nạp nguồn (push từ main). Trả hàm huỷ đăng ký. */
  onSourceProgress: (cb: (e: SourceProgressEvent) => void): (() => void) => {
    const listener = (_e: unknown, payload: SourceProgressEvent): void =>
      cb(payload);
    ipcRenderer.on(CHANNELS.sourceProgress, listener);
    return () => ipcRenderer.removeListener(CHANNELS.sourceProgress, listener);
  },
  /** Lấy đường dẫn tuyệt đối của một File (kéo-thả/chọn) để gửi cho main đọc (sandbox-safe). */
  getFilePath: (file: File): string => webUtils.getPathForFile(file),
  // rag-qa (013)
  ragAsk: (input: RagAskInput): Promise<RagAnswer> =>
    ipcRenderer.invoke(CHANNELS.ragAsk, input),
  // studio (021) — sinh + đọc bản tổng hợp.
  studioGenerate: (input: StudioGenerateInput): Promise<StudioResult> =>
    ipcRenderer.invoke(CHANNELS.studioGenerate, input),
  studioList: (notebookId: string): Promise<StudioResult[]> =>
    ipcRenderer.invoke(CHANNELS.studioList, notebookId),
};

export type Api = typeof api;

contextBridge.exposeInMainWorld("api", api);
