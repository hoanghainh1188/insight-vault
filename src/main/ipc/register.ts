import { ipcMain } from "electron";
import { CHANNELS, isWhitelisted } from "@shared/ipc/channels";
import type {
  CreateNotebookInput,
  DataDirInfo,
  ModelSelection,
  RenameNotebookInput,
  SetColorInput,
} from "@shared/ipc/types";
import { getPrivacyState } from "../services/app-shell/privacy-state";
import { buildAppInfo } from "../services/app-shell/app-info";
import {
  getOnboardingState,
  setOnboardingComplete,
  type StoreLike,
} from "../services/app-shell/onboarding";
import { createAiRuntime } from "../services/ai-runtime/ai-runtime";
import type { NotebookRepo } from "../services/notebooks/notebook-repo";
import { logEvent } from "../logging";

interface RegisterDeps {
  store: StoreLike;
  version: string;
  dataDir: DataDirInfo;
  notebookRepo: NotebookRepo;
}

/**
 * Đăng ký IPC handler CHỈ cho các kênh whitelisted (Constitution III, US2).
 * KHÔNG có handler catch-all: renderer gọi kênh ngoài danh sách ⇒ không có handler ⇒ Promise reject,
 * không side effect. `safeHandle` chặn cứng nếu ai đó lỡ đăng ký tên ngoài whitelist.
 */
export function registerIpc({
  store,
  version,
  dataDir,
  notebookRepo,
}: RegisterDeps): void {
  const safeHandle = (
    channel: string,
    fn: (...a: unknown[]) => unknown,
  ): void => {
    if (!isWhitelisted(channel)) {
      throw new Error(`IPC channel không nằm trong whitelist: ${channel}`);
    }
    // Truyền args từ renderer (bỏ event object đầu tiên). KHÔNG log args (có thể chứa nội dung).
    ipcMain.handle(channel, (_event, ...args) => fn(...args));
  };

  // app-shell (001)
  safeHandle(CHANNELS.getDataDir, () => dataDir);
  safeHandle(CHANNELS.getPrivacyState, () => getPrivacyState());
  safeHandle(CHANNELS.getOnboardingState, () => getOnboardingState(store));
  safeHandle(CHANNELS.setOnboardingComplete, () =>
    setOnboardingComplete(store),
  );
  safeHandle(CHANNELS.getAppInfo, () => buildAppInfo(version));

  // ai-runtime (007) — Ollama gọi CHỈ ở đây (main); renderer chạm qua 5 kênh này.
  const ai = createAiRuntime(store);
  safeHandle(CHANNELS.aiListModels, () => ai.listModels());
  safeHandle(CHANNELS.aiTestConnection, () => ai.testConnection());
  safeHandle(CHANNELS.aiGetSelectedModels, () => ai.getSelectedModels());
  safeHandle(CHANNELS.aiSetSelectedModels, (sel) =>
    ai.setSelectedModels(sel as ModelSelection),
  );
  safeHandle(CHANNELS.aiGetRuntimeStatus, () => ai.getRuntimeStatus());

  // notebooks (009) — SQLite gọi CHỈ ở đây (main, qua repo). KHÔNG log tên notebook (args không vào logEvent).
  safeHandle(CHANNELS.notebookList, () => notebookRepo.list());
  safeHandle(CHANNELS.notebookCreate, (input) =>
    notebookRepo.create(input as CreateNotebookInput),
  );
  safeHandle(CHANNELS.notebookRename, (input) =>
    notebookRepo.rename(input as RenameNotebookInput),
  );
  safeHandle(CHANNELS.notebookSetColor, (input) =>
    notebookRepo.setColor(input as SetColorInput),
  );
  safeHandle(CHANNELS.notebookDelete, (id) =>
    notebookRepo.delete(id as string),
  );

  logEvent("ipc.registered", { channels: Object.values(CHANNELS).length });
}
