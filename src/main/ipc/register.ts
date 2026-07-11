import { ipcMain } from "electron";
import { CHANNELS, isWhitelisted } from "@shared/ipc/channels";
import type {
  AddSourceInput,
  CreateNotebookInput,
  DataDirInfo,
  ModelSelection,
  RagAskInput,
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
import type { AiRuntime } from "../services/ai-runtime/ai-runtime";
import type { NotebookRepo } from "../services/notebooks/notebook-repo";
import type { SourceRepo } from "../services/ingestion/source-repo";
import type { IngestionPipeline } from "../services/ingestion/pipeline";
import type { VectorStore } from "../services/ingestion/vector-store";
import type { RagService } from "../services/rag/rag-service";
import { getSourceContent } from "../services/source-viewer/source-content";
import { logEvent } from "../logging";

interface RegisterDeps {
  store: StoreLike;
  version: string;
  dataDir: DataDirInfo;
  notebookRepo: NotebookRepo;
  sourceRepo: SourceRepo;
  pipeline: IngestionPipeline;
  vectorStore: VectorStore;
  aiRuntime: AiRuntime;
  ragService: RagService;
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
  sourceRepo,
  pipeline,
  vectorStore,
  aiRuntime,
  ragService,
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

  // ai-runtime (007) — Ollama gọi CHỈ ở đây (main); renderer chạm qua 5 kênh này. Cùng instance với pipeline.
  const ai = aiRuntime;
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
  // Xoá notebook: dọn vector LanceDB theo notebook_id TRƯỚC (tránh mồ côi), rồi xoá SQLite (cascade
  // source→chunk). Nhất quán 2 store (ADR lancedb-integration, FR-015).
  safeHandle(CHANNELS.notebookDelete, async (id) => {
    await vectorStore.deleteByNotebook(id as string);
    return notebookRepo.delete(id as string);
  });

  // ingestion (011) — FS/parse/embed/LanceDB CHỈ ở main (Constitution III). KHÔNG log nội dung tài liệu.
  safeHandle(CHANNELS.sourceAdd, (input) =>
    pipeline.add(input as AddSourceInput),
  );
  safeHandle(CHANNELS.sourceListByNotebook, (id) =>
    sourceRepo.listByNotebook(id as string),
  );
  safeHandle(CHANNELS.sourceGet, (id) => sourceRepo.getById(id as string));
  safeHandle(CHANNELS.sourceDelete, (id) => pipeline.remove(id as string));
  safeHandle(CHANNELS.sourceRetry, (id) => pipeline.retry(id as string));
  // source-viewer (019) — tái dựng toàn văn từ chunk đã lưu để hiển thị. CHỈ đọc; KHÔNG log content.
  safeHandle(CHANNELS.sourceGetContent, (id) =>
    getSourceContent(sourceRepo, id as string),
  );

  // rag-qa (013) — embed/search/chat CHỈ ở đây (main). KHÔNG log payload (câu hỏi/nội dung — Constitution III).
  safeHandle(CHANNELS.ragAsk, (input) => ragService.ask(input as RagAskInput));

  logEvent("ipc.registered", { channels: Object.values(CHANNELS).length });
}
