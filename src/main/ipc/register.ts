import { UserFacingError } from "@shared/codes/user-error";
import { app, ipcMain, BrowserWindow, clipboard, shell } from "electron";
import { CHANNELS, isWhitelisted } from "@shared/ipc/channels";
import type {
  AddSourceInput,
  CreateNotebookInput,
  DataDirInfo,
  ModelSelection,
  OnlineProviderId,
  RagAskInput,
  RagAskStreamInput,
  RagStreamTokenEvent,
  RenameNotebookInput,
  SetColorInput,
  SetProviderKeyInput,
  SetProviderModelInput,
  StudioGenerateInput,
  ModelRecommendation,
  OllamaHealth,
  ReindexStatus,
  SourceRelinkResult,
  SourceReprocessResult,
} from "@shared/ipc/types";
import { getPrivacyState } from "../services/app-shell/privacy-state";
import { computeStorageInfo } from "../services/app-shell/storage-info";
import { createFsOps } from "../services/app-shell/storage-fs";
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
import type { UiLanguageService } from "../services/ui-language";
import type { RagService } from "../services/rag/rag-service";
import type { ChatRepo } from "../services/rag/chat-repo";
import type { StudioService } from "../services/studio/studio-service";
import type { ContentSearch } from "../services/search/content-search";
import { exportMarkdown } from "../services/studio/export";
import {
  getSourceContent,
  type SourceContentRequest,
} from "../services/source-viewer/source-content";
import { logError, logEvent } from "../logging";
import { createRendererErrorReporter } from "../services/app-log/renderer-error";
import type { CrashService } from "../services/crash-report/crash-service";
import {
  parseAiTarget,
  rethrowForIpc,
  type AiTarget,
} from "../services/ai-runtime/ai-target";
import type { BackupService } from "../services/vault-backup/backup-service";
import type { VaultLock } from "../services/vault-backup/vault-lock";
import {
  parseBackupCreateInput,
  parseRestoreTokenInput,
} from "../services/vault-backup/ipc-input";

interface RegisterDeps {
  store: StoreLike;
  version: string;
  dataDir: DataDirInfo;
  notebookRepo: NotebookRepo;
  sourceRepo: SourceRepo;
  pipeline: IngestionPipeline;
  vectorStore: VectorStore;
  aiRuntime: AiRuntime;
  // 098: theo đích AI của lượt — active (provider đang bật) / local (Ollama).
  ragServices: Record<AiTarget, RagService>;
  chatRepo: ChatRepo;
  studioServices: Record<AiTarget, StudioService>;
  contentSearch: ContentSearch;
  // 059 — gợi ý model theo RAM + health Ollama + trạng thái reindex.
  recommendChatModel: () => ModelRecommendation;
  ollamaHealth: () => Promise<OllamaHealth>;
  reindexStatus: () => ReindexStatus;
  // 085 — sao lưu/khôi phục vault + khoá chặn ghi trong lúc chụp/sau xác nhận khôi phục.
  backupService: BackupService;
  vaultLock: VaultLock;
  // 088 — thư mục nhật ký (mở bằng trình quản lý tệp từ Cài đặt / màn hình lỗi).
  logsDir: string;
  // 093 — báo lỗi opt-in.
  crashService: CrashService;
  // 101 — chọn lại tệp gốc.
  relinkSource: (id: unknown) => Promise<SourceRelinkResult>;
  // 112 — xử lý lại PDF (kiểm khoá kho / quy tắc / tệp gốc trong handler).
  reprocessSource: (id: unknown) => Promise<SourceReprocessResult>;
  // 123 — ngôn ngữ giao diện (lưu lựa chọn + ngôn ngữ hiệu lực).
  uiLanguage: UiLanguageService;
}

/** Số báo lỗi renderer tối đa ghi mỗi phiên (chặn vòng lặp lỗi làm phình nhật ký) — 088. */
const MAX_RENDERER_ERROR_REPORTS = 50;

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
  ragServices,
  chatRepo,
  studioServices,
  contentSearch,
  recommendChatModel,
  ollamaHealth,
  reindexStatus,
  backupService,
  vaultLock,
  logsDir,
  crashService,
  relinkSource,
  reprocessSource,
  uiLanguage,
}: RegisterDeps): void {
  const safeHandle = (
    channel: string,
    fn: (...a: unknown[]) => unknown,
  ): void => {
    if (!isWhitelisted(channel)) {
      throw new Error(`IPC channel not whitelisted: ${channel}`);
    }
    // Truyền args từ renderer (bỏ event object đầu tiên). KHÔNG log args (có thể chứa nội dung).
    ipcMain.handle(channel, (_event, ...args) => fn(...args));
  };

  // app-shell (001)
  safeHandle(CHANNELS.getDataDir, () => dataDir);
  // 037: thông tin lưu trữ (chỉ đọc kích thước thư mục dữ liệu + dung lượng ổ; KHÔNG log nội dung).
  safeHandle(CHANNELS.getStorageInfo, () =>
    computeStorageInfo(dataDir.path, createFsOps()),
  );
  safeHandle(CHANNELS.getPrivacyState, () => getPrivacyState());
  // 123: đọc/đặt ngôn ngữ giao diện; set kiểm enum ở service (giá trị khác ⇒ ném, không ghi).
  safeHandle(CHANNELS.getUiLanguage, () => uiLanguage.get());
  safeHandle(CHANNELS.setUiLanguage, (pref) => uiLanguage.set(pref));
  safeHandle(CHANNELS.getOnboardingState, () => getOnboardingState(store));
  safeHandle(CHANNELS.setOnboardingComplete, () =>
    setOnboardingComplete(store),
  );
  safeHandle(CHANNELS.getAppInfo, () => buildAppInfo(version));
  // ghi clipboard qua main (#67): navigator.clipboard bị chặn bởi permission handler + file:// không phải
  // secure context ở bản đóng gói. Dùng Electron clipboard (local, không egress). KHÔNG log nội dung.
  safeHandle(CHANNELS.clipboardWrite, (text) => {
    clipboard.writeText(String(text));
    return { ok: true } as const;
  });
  // app-log (088): renderer chỉ gửi loại lỗi + componentStack; main làm sạch + chặn lũ rồi ghi nhật ký.
  safeHandle(
    CHANNELS.reportRendererError,
    createRendererErrorReporter({
      log: logError,
      max: MAX_RENDERER_ERROR_REPORTS,
    }),
  );
  // Mở thư mục nhật ký CỐ ĐỊNH (không nhận path từ renderer). shell.openPath trả "" khi thành công.
  safeHandle(CHANNELS.openLogsFolder, async () => {
    if (!logsDir) return { ok: false }; // khởi tạo nhật ký thất bại lúc khởi động
    const err = await shell.openPath(logsDir);
    if (err) logEvent("logs.openFailed", {});
    return { ok: err === "" };
  });
  // crash-report (093): bản nháp đã làm sạch; mở issue với đích CỐ ĐỊNH (renderer chỉ gửi tiêu đề + nội dung).
  safeHandle(CHANNELS.crashGetReport, () => crashService.getReport());
  safeHandle(CHANNELS.crashOpenIssue, (input) => crashService.openIssue(input));
  safeHandle(CHANNELS.crashGetNotice, () => crashService.getNotice());
  safeHandle(CHANNELS.crashDismissNotice, () => crashService.dismissNotice());

  // ai-runtime (007) — Ollama gọi CHỈ ở đây (main); renderer chạm qua 5 kênh này. Cùng instance với pipeline.
  const ai = aiRuntime;
  safeHandle(CHANNELS.aiListModels, () => ai.listModels());
  safeHandle(CHANNELS.aiTestConnection, () => ai.testConnection());
  safeHandle(CHANNELS.aiGetSelectedModels, () => ai.getSelectedModels());
  safeHandle(CHANNELS.aiSetSelectedModels, (sel) =>
    ai.setSelectedModels(sel as ModelSelection),
  );
  safeHandle(CHANNELS.aiGetRuntimeStatus, () => ai.getRuntimeStatus());
  // 059 — gợi ý cỡ model chat theo RAM (chỉ gợi ý) + health-check Ollama (chat). Read-only, không tự tải.
  safeHandle(CHANNELS.aiRecommendModel, () => recommendChatModel());
  safeHandle(CHANNELS.aiOllamaHealth, () => ollamaHealth());
  // 059 — trạng thái tái lập chỉ mục (đổi engine embedding).
  safeHandle(CHANNELS.embedReindexStatus, () => reindexStatus());

  // online-provider (031) — network + keytar CHỈ ở main; renderer qua 6 kênh này. KHÔNG log key/nội dung.
  // Validate boundary trong online-runtime (id whitelist, key/model). Trả OnlineState (không chứa key).
  safeHandle(CHANNELS.aiGetOnlineState, () => ai.online.getOnlineState());
  safeHandle(CHANNELS.aiSetProviderKey, (input) =>
    ai.online.setProviderKey(input as SetProviderKeyInput),
  );
  safeHandle(CHANNELS.aiDeleteProviderKey, (id) =>
    ai.online.deleteProviderKey(id as OnlineProviderId),
  );
  safeHandle(CHANNELS.aiSetProviderModel, (input) =>
    ai.online.setProviderModel(input as SetProviderModelInput),
  );
  safeHandle(CHANNELS.aiSetActiveProvider, (id) =>
    ai.online.setActiveProvider(id as OnlineProviderId | null),
  );
  safeHandle(CHANNELS.aiTestProvider, (id) =>
    ai.online.testProvider(id as OnlineProviderId),
  );

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
  // 085: chặn các kênh GHI vault khi đang chụp dữ liệu / đã xác nhận khôi phục (vault lock).
  const assertVaultWritable = (): void => {
    // 123: mã "vaultLocked" — giao diện dịch theo ngôn ngữ hiện tại (085, R7).
    if (vaultLock.isLocked()) throw new UserFacingError("vaultLocked");
  };

  safeHandle(CHANNELS.notebookDelete, async (id) => {
    assertVaultWritable();
    await vectorStore.deleteByNotebook(id as string);
    return notebookRepo.delete(id as string);
  });

  // ingestion (011) — FS/parse/embed/LanceDB CHỈ ở main (Constitution III). KHÔNG log nội dung tài liệu.
  safeHandle(CHANNELS.sourceAdd, (input) => {
    assertVaultWritable();
    return pipeline.add(input as AddSourceInput);
  });
  safeHandle(CHANNELS.sourceListByNotebook, (id) =>
    sourceRepo.listByNotebook(id as string),
  );
  safeHandle(CHANNELS.sourceGet, (id) => sourceRepo.getById(id as string));
  safeHandle(CHANNELS.sourceDelete, (id) => {
    assertVaultWritable();
    return pipeline.remove(id as string);
  });
  safeHandle(CHANNELS.sourceRetry, (id) => {
    assertVaultWritable();
    return pipeline.retry(id as string);
  });
  // 101: chọn lại tệp gốc (đổi origin) — là thao tác GHI vault ⇒ chặn khi đang sao lưu/khôi phục.
  safeHandle(CHANNELS.sourceRelink, (id) => {
    assertVaultWritable();
    return relinkSource(id);
  });
  // 112: xử lý lại PDF — là thao tác GHI vault ⇒ chặn khi đang sao lưu/khôi phục (kiểm lại lúc hoán đổi).
  safeHandle(CHANNELS.sourceReprocess, (id) => {
    assertVaultWritable();
    return reprocessSource(id);
  });
  safeHandle(CHANNELS.sourceReprocessCancel, (id) => ({
    cancelled: typeof id === "string" && pipeline.cancelReprocess(id),
  }));
  // source-viewer (019) — tái dựng toàn văn từ chunk đã lưu để hiển thị. CHỈ đọc; KHÔNG log content.
  // 112: nhận id hoặc {sourceId, chunkId} — getSourceContent tự validate kiểu (sai ⇒ null).
  safeHandle(CHANNELS.sourceGetContent, (req) =>
    getSourceContent(sourceRepo, req as string | SourceContentRequest),
  );
  // content-search (073) — tìm toàn văn nội dung nguồn trong notebook (FTS5 BM25). CHỈ đọc; KHÔNG log query.
  safeHandle(CHANNELS.sourceSearch, (input) => {
    const { notebookId, query } = input as {
      notebookId: string;
      query: string;
    };
    return contentSearch.search(notebookId, query);
  });

  // rag-qa (013) — embed/search/chat CHỈ ở đây (main). KHÔNG log payload (câu hỏi/nội dung — Constitution III).
  // 098: đích AI theo lượt (input.target) + lỗi provider online gắn thẻ để renderer hiện nút "AI cục bộ".
  safeHandle(CHANNELS.ragAsk, async (input) => {
    const target = parseAiTarget(input);
    try {
      return await ragServices[target].ask(input as RagAskInput);
    } catch (e) {
      return rethrowForIpc(e);
    }
  });

  // streaming (039) — Chat trả lời chạy dần. Token đẩy qua rag:streamToken (webContents.send); huỷ qua
  // rag:stop (AbortController theo streamId). KHÔNG log token/nội dung.
  const streamControllers = new Map<string, AbortController>();
  const emitToken = (e: RagStreamTokenEvent): void => {
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send(CHANNELS.ragStreamToken, e);
    }
  };
  safeHandle(CHANNELS.ragAskStream, async (input) => {
    const streamId = (input as { streamId?: unknown }).streamId;
    if (typeof streamId !== "string" || streamId === "") {
      throw new Error("Invalid streamId.");
    }
    // Kiểm đích AI TRƯỚC khi giữ controller — ném ở đây không để lại entry mồ côi trong streamControllers.
    const target = parseAiTarget(input);
    const controller = new AbortController();
    streamControllers.set(streamId, controller);
    try {
      return await ragServices[target].askStream(input as RagAskStreamInput, {
        onToken: (delta) => emitToken({ streamId, delta }),
        signal: controller.signal,
      });
    } catch (e) {
      return rethrowForIpc(e);
    } finally {
      streamControllers.delete(streamId);
    }
  });
  safeHandle(CHANNELS.ragStop, (streamId) => {
    const c = streamControllers.get(streamId as string);
    if (c) c.abort();
    return { stopped: true } as const;
  });
  // Đóng hết cửa sổ (macOS: app còn chạy nền) → huỷ mọi stream đang chạy để KHÔNG egress ngầm ngoài tầm
  // quan sát của người dùng (Constitution I — chỉ báo khớp hành vi). Nút Dừng nằm ở renderer đã đóng.
  app.on("window-all-closed", () => {
    for (const c of streamControllers.values()) c.abort();
    streamControllers.clear();
  });

  // chat-history (027) — nạp/xoá lịch sử hội thoại. Đọc/ghi DB CHỈ ở main. KHÔNG log nội dung.
  const notebookIdOf = (input: unknown): string => {
    const id = (input as { notebookId?: unknown }).notebookId;
    if (typeof id !== "string" || id === "") {
      throw new Error("Invalid notebookId.");
    }
    return id;
  };
  safeHandle(CHANNELS.chatHistory, (input) =>
    chatRepo.listByNotebook(notebookIdOf(input)),
  );
  safeHandle(CHANNELS.chatClear, (input) => {
    chatRepo.clear(notebookIdOf(input));
    return { cleared: true } as const;
  });

  // studio (021) — tổng hợp toàn notebook (đọc chunk + chat CHỈ ở main). KHÔNG log content/citations.
  safeHandle(CHANNELS.studioGenerate, async (input) => {
    const target = parseAiTarget(input);
    try {
      return await studioServices[target].generate(
        input as StudioGenerateInput,
      );
    } catch (e) {
      return rethrowForIpc(e);
    }
  });
  safeHandle(CHANNELS.studioList, (id) =>
    studioServices.active.list(id as string),
  );
  // studio export (025) — ghi .md qua save dialog (main). KHÔNG log content.
  safeHandle(CHANNELS.studioExport, (input) => {
    const { content, suggestedName } = input as {
      content: string;
      suggestedName: string;
    };
    return exportMarkdown(
      BrowserWindow.getFocusedWindow(),
      content,
      suggestedName,
      uiLanguage.translator(),
    );
  });

  // vault-backup (085) — FS/crypto/hộp thoại CHỈ ở main; renderer không gửi path (token thay path).
  // Payload validate ở boundary (ipc-input); sai hình ⇒ ioError. KHÔNG log payload (chứa mật khẩu).
  const invalidPayload = { status: "error", code: "ioError" } as const;
  safeHandle(CHANNELS.backupGetState, () => backupService.getState());
  safeHandle(CHANNELS.backupCreate, (input) => {
    const req = parseBackupCreateInput(input);
    return req ? backupService.createBackup(req) : invalidPayload;
  });
  safeHandle(CHANNELS.restorePick, () => backupService.pickRestore());
  safeHandle(CHANNELS.restorePrepare, (input) => {
    const req = parseRestoreTokenInput(input);
    return req ? backupService.prepareRestore(req) : invalidPayload;
  });
  safeHandle(CHANNELS.restoreConfirm, (input) => {
    const req = parseRestoreTokenInput(input);
    return req ? backupService.confirmRestore(req) : invalidPayload;
  });
  safeHandle(CHANNELS.restoreCancel, (input) => {
    const req = parseRestoreTokenInput(input);
    return req ? backupService.cancelRestore(req) : { ok: true };
  });
  safeHandle(CHANNELS.getRestoreResult, () => backupService.getRestoreResult());

  logEvent("ipc.registered", { channels: Object.values(CHANNELS).length });
}
