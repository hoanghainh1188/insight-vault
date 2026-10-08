import { join } from "node:path";
import { existsSync } from "node:fs";
import { realpath } from "node:fs/promises";
import {
  app,
  BrowserWindow,
  crashReporter,
  dialog,
  nativeImage,
  protocol,
  session,
  shell,
} from "electron";
import Store from "electron-store";
import { CHANNELS } from "@shared/ipc/channels";
import type { SourceProgressEvent } from "@shared/ipc/types";
import { ensureDataDir } from "./services/app-shell/data-dir";
import { registerIpc } from "./ipc/register";
import { openDatabase } from "./db/database";
import { runMigrations } from "./db/migrations";
import { createNotebookRepo } from "./services/notebooks/notebook-repo";
import { createAiRuntime } from "./services/ai-runtime/ai-runtime";
import { createIngestion } from "./services/ingestion/ingestion";
import { createRagService } from "./services/rag/rag-service";
import { rewriteQuery } from "./services/rag/rewrite";
import { createKeywordStore } from "./services/ingestion/keyword-store";
import { createChatRepo } from "./services/rag/chat-repo";
import { createStudioRepo } from "./services/studio/studio-repo";
import { createStudioService } from "./services/studio/studio-service";
import { createContentSearch } from "./services/search/content-search";
import {
  onPrivacyChange,
  setEgressActive,
} from "./services/app-shell/privacy-state";
import { startupErrorDialog } from "./services/app-shell/startup-error";
import { createMediaHandler } from "./services/source-viewer/media-serve";
import { logError, logEvent, setLogSink } from "./logging";
import { createFileSink, resolveLogsDir } from "./services/app-log/log-file";
import { createNodeLogFs } from "./services/app-log/log-fs";
import { createSessionMarker } from "./services/crash-report/session-marker";
import {
  createNodeMarkerFs,
  listCrashDumps,
  readLogTail,
  restrictDumpDir,
} from "./services/crash-report/crash-fs";
import { createCrashService } from "./services/crash-report/crash-service";
import { createRelink } from "./services/ingestion/relink";
import { createReprocessRequest } from "./services/ingestion/reprocess-request";
import { pickSourceFile } from "./services/ingestion/relink-dialog";
import { hashFileStreaming } from "./services/ingestion/ingestion";
import {
  pickProvider as pickProviderFor,
  type AiTarget,
} from "./services/ai-runtime/ai-target";
import { numCtxFor, studioContextFor } from "./services/studio/context-window";
import { runReindex, needsReindex } from "./services/embedding/reindex-runner";
import { recommendChatModel } from "./services/ai/model-recommend";
import { checkOllama } from "./services/ai/ollama-health";
import type { ReindexStatus } from "@shared/ipc/types";
import { homedir, release, totalmem } from "node:os";
import { applyPendingRestore } from "./services/vault-backup/restore-swap";
import { createBackupService } from "./services/vault-backup/backup-service";
import {
  createVaultLock,
  isVaultBusy,
} from "./services/vault-backup/vault-lock";
import {
  createVectorMaintenance,
  type VectorMaintenance,
} from "./services/vector-maintenance/maintenance";
import { BACKUP_WAIT_TIMEOUT_MS } from "./services/vector-maintenance/constants";
import { createFsOps } from "./services/app-shell/storage-fs";
import { dirSize } from "./services/app-shell/storage-info";
import { createElectronDialogs } from "./services/vault-backup/dialogs";
import { createUiLanguageService } from "./services/ui-language";

// 049: đăng ký scheme iv-media:// là privileged (stream + fetch API) TRƯỚC khi app ready — cho <audio> phát
// file audio gốc qua main (renderer sandbox không đọc FS). Handler đăng ký ở whenReady (cần sourceRepo).
protocol.registerSchemesAsPrivileged([
  { scheme: "iv-media", privileges: { stream: true, supportFetchAPI: true } },
]);

// Hardening cấp session (Constitution I & III): từ chối mọi permission request (app-shell không cần
// camera/mic/geo/…); chặn mở device (USB/HID/serial). Local-first: không có bề mặt xin quyền nào.
function installSecurity(): void {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  ses.setPermissionCheckHandler(() => false);
  ses.setDevicePermissionHandler(() => false);
}

// Icon runtime (041/045): dock macOS lúc DEV + window/taskbar Windows/Linux đều dùng icon Electron mặc định
// nếu không set (bản đóng gói mac dùng .icns từ bundle; win dùng .ico của exe). Tìm build/icon.png ở dev
// (app root) hoặc resources (đóng gói, qua extraResources). Trả null nếu không có → giữ mặc định.
function resolveIconPath(): string | null {
  const candidates = [
    join(app.getAppPath(), "build", "icon.png"),
    join(process.resourcesPath, "icon.png"),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

// Đã từng dựng cửa sổ chưa (chốt một chiều) — phân biệt lỗi giai đoạn khởi động vs lỗi runtime muộn.
let everShownWindow = false;

function createWindow(): void {
  everShownWindow = true;
  const iconPath = resolveIconPath();
  const win = new BrowserWindow({
    width: 1120,
    height: 720,
    minWidth: 720,
    minHeight: 480,
    show: false,
    ...(iconPath ? { icon: iconPath } : {}), // Windows/Linux taskbar + window
    // Frame OS mặc định (clarify A3) — nút minimize/maximize/close native.
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      // Ranh giới bảo mật bất biến (Constitution III / ADR D5).
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once("ready-to-show", () => win.show());

  // Local-first: chặn mọi điều hướng ra ngoài + cửa sổ popup ngoài (Constitution I).
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e, url) => {
    // Chỉ cho phép nội bộ app (dev server localhost hoặc file:// đã load). Mọi URL khác → chặn cứng.
    const allowed = process.env["ELECTRON_RENDERER_URL"] ?? "file://";
    if (!url.startsWith(allowed) && !url.startsWith("file://")) {
      e.preventDefault();
      logEvent("navigation.blocked", { blocked: true });
    }
  });

  if (process.env["ELECTRON_RENDERER_URL"]) {
    void win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// Xử lý lỗi khởi động: hiện dialog rõ ràng thay vì "chết âm thầm" (cửa sổ show:false, không catch →
// createWindow không chạy → app mở nhưng biến mất). Chỉ THOÁT khi lỗi xảy ra TRƯỚC khi có cửa sổ
// (giai đoạn khởi động); nếu đã có cửa sổ, lỗi runtime muộn chỉ log — không giết phiên người dùng.
// Constitution III: chỉ log errorType (không path/nội dung); detail dialog do hàm thuần startupErrorDialog dựng.
// Trạng thái nhật ký/phiên (088/093) khai báo TRƯỚC mọi handler dùng tới — uncaughtException có thể bắn ngay lúc
// nạp module, đọc biến `let` khai báo sau sẽ dính TDZ.
let logsDir = "";
/** Phiên trước kết thúc bất thường? (tính lúc khởi động, đọc bởi crash service). */
let abnormalExit = false;
/** Khởi động thất bại ⇒ GIỮ tệp đánh dấu phiên: lần mở sau vẫn mời gửi báo cáo (093). */
let keepSessionMarker = false;

let fatalHandled = false;
function handleFatalStartup(err: unknown): void {
  if (fatalHandled) return;
  const { title, detail, errorType } = startupErrorDialog(err);
  // 088: lỗi muộn (đã có cửa sổ) ghi riêng "runtime.uncaught" để phân biệt khi đọc nhật ký.
  logError(everShownWindow ? "runtime.uncaught" : "startup.error", {
    errorType,
  });
  // Chốt một chiều: chỉ THOÁT nếu chưa từng dựng cửa sổ (giai đoạn khởi động). Không dùng số cửa sổ
  // hiện tại vì trên macOS đóng hết cửa sổ KHÔNG thoát app (idle ở dock) → sẽ về 0 và hiểu nhầm lỗi
  // runtime muộn là lỗi khởi động rồi giết phiên người dùng. Sau khi UI đã lên, lỗi muộn chỉ log.
  if (everShownWindow) return;
  fatalHandled = true;
  keepSessionMarker = true;
  dialog.showErrorBox(title, detail);
  app.quit();
}

process.on("uncaughtException", handleFatalStartup);
process.on("unhandledRejection", handleFatalStartup);

// Single-instance lock (#70): 2 tiến trình cùng ghi SQLite/LanceDB + cùng chạy reindex nền lúc khởi động
// → hỏng dữ liệu/race migration. Instance thứ 2 KHÔNG lấy được lock → thoát ngay và focus cửa sổ đang có
// (không chạy init). Guard trong whenReady chặn init kể cả khi handler kịp chạy trước lúc quit hoàn tất.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}
const sessionMarker = (dir: string) =>
  createSessionMarker({ dir, fs: createNodeMarkerFs() });
/** Thoát sạch ⇒ xoá tệp đánh dấu phiên. Gọi cả ở đường app.exit (không phát will-quit). */
const endSession = (): void => {
  if (logsDir && !keepSessionMarker) sessionMarker(logsDir).end();
};
app.on("will-quit", endSession);

// 088: nhật ký ra file — chỉ instance giữ lock (instance thứ 2 thoát ngay, không tranh ghi cùng tệp). Lỗi dựng
// sink ⇒ chỉ còn console, app vẫn chạy (nhật ký là phụ trợ, không được làm hỏng khởi động).
if (gotSingleInstanceLock) {
  try {
    logsDir = resolveLogsDir({
      packaged: app.isPackaged,
      osLogsPath: app.getPath("logs"),
      userDataPath: app.getPath("userData"),
    });
    setLogSink(
      createFileSink({
        dir: logsDir,
        fs: createNodeLogFs(),
        onError: (errorType) =>
          console.error("[InsightVault] logfile.disabled", { errorType }),
      }),
    );
  } catch (e) {
    console.error("[InsightVault] logfile.init.error", {
      errorType: e instanceof Error ? e.constructor.name : typeof e,
    });
  }
  logEvent("app.start", {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    packaged: app.isPackaged,
  });

  // 093: crash native ghi minidump CHỈ trên máy (ADR crash-report-clarify) — không bao giờ tự tải lên; dump có
  // thể chứa nội dung tài liệu trong bộ nhớ nên cũng không đính kèm vào báo cáo.
  crashReporter.start({ uploadToServer: false });
  try {
    restrictDumpDir(app.getPath("crashDumps"));
  } catch (e) {
    logEvent("crash.dumpDirRestrictFailed", {
      errorType: e instanceof Error ? e.constructor.name : typeof e,
    });
  }
  // Tệp đánh dấu phiên: còn sót lúc khởi động ⇒ lần trước không thoát sạch ⇒ mời người dùng gửi báo cáo.
  if (logsDir) {
    abnormalExit = sessionMarker(logsDir).begin();
    if (abnormalExit) logEvent("app.previousSessionAbnormal", {});
  }
}

// 088: tiến trình renderer/GPU/utility chết — trước đây không để lại dấu vết. Chỉ log lý do + mã thoát.
app.on("render-process-gone", (_e, _wc, details) => {
  logError("renderer.gone", {
    reason: details.reason,
    exitCode: details.exitCode,
  });
});
app.on("child-process-gone", (_e, details) => {
  logError("childProcess.gone", {
    type: details.type,
    reason: details.reason,
    exitCode: details.exitCode,
  });
});

app.on("second-instance", () => {
  const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app
  .whenReady()
  .then(async () => {
    // Instance thứ 2 (không có lock) đã gọi app.quit() — KHÔNG chạy init để tránh chạm DB/LanceDB.
    if (!gotSingleInstanceLock) return;
    // Icon dock macOS: bản đóng gói lấy từ bundle .icns; khi DEV thì phải set thủ công (nếu không → icon
    // Electron mặc định). Không lỗi nếu thiếu file/không phải macOS.
    if (process.platform === "darwin" && app.dock) {
      const ic = resolveIconPath();
      if (ic) app.dock.setIcon(nativeImage.createFromPath(ic));
    }
    // Đảm bảo data dir tồn tại (FR-011/012). userData = chuẩn OS (F1).
    const dataDir = await ensureDataDir(app.getPath("userData"));
    if (!dataDir.ready) {
      // 088: không log đường dẫn (chứa tên tài khoản) — dialog bên dưới đã hiện cho người dùng.
      logError("datadir.error", { ready: false });
      keepSessionMarker = true;
      dialog.showErrorBox(
        "Không tạo được thư mục dữ liệu",
        `InsightVault không thể tạo thư mục dữ liệu tại:\n${dataDir.path}\n\nKiểm tra quyền truy cập hoặc dung lượng ổ đĩa rồi mở lại ứng dụng.`,
      );
      app.quit();
      return;
    }

    // 085: hoán đổi vault đã dàn dựng (khôi phục) TRƯỚC khi mở config/DB/LanceDB. Lỗi rollback ⇒ ném (fatal
    // startup dialog) thay vì mở DB rỗng. Không log path.
    const restoreOutcome = await applyPendingRestore(
      dataDir.path,
      undefined,
      logEvent,
    );
    if (restoreOutcome !== "none") {
      logEvent("vaultBackup.restoreApplied", { outcome: restoreOutcome });
    }

    const store = new Store();
    // 123: ngôn ngữ giao diện — lựa chọn ở store, auto ⇒ locale OS; IV_UI_LANG chỉ cho bản chưa đóng gói (e2e/dev).
    const uiLanguage = createUiLanguageService({
      store,
      osLocale: () => app.getPreferredSystemLanguages()[0] ?? app.getLocale(),
      envOverride: process.env.IV_UI_LANG,
      isPackaged: app.isPackaged,
    });

    // SQLite (009): mở DB trong data dir, chạy migration (nay tới v2 — bảng source/chunk), tạo repo.
    const db = openDatabase(join(dataDir.path, "insightvault.db"));
    runMigrations(db);
    const notebookRepo = createNotebookRepo(db);

    // ai-runtime (007) — một instance dùng chung cho kênh ai:* và pipeline embed.
    const aiRuntime = createAiRuntime(store);

    // ingestion (011): LanceDB + pipeline. Progress push tới mọi cửa sổ qua source:progress.
    const emitProgress = (e: SourceProgressEvent): void => {
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) w.webContents.send(CHANNELS.sourceProgress, e);
      }
    };
    // 116: tạo sau vaultLock (bên dưới); ingestion gọi qua ref lười như isVaultLocked.
    let vectorMaintenance: VectorMaintenance | null = null;
    const ingestion = await createIngestion({
      db,
      dataDir: dataDir.path,
      aiRuntime,
      emit: emitProgress,
      // bật chỉ báo khi fetch URL (FR-019) / tải model lần đầu — 103: loại egress quyết định nhãn badge.
      setOnline: (online, kind) => setEgressActive(online, kind ?? "url"),
      // 112: gọi lúc hoán đổi dữ liệu của "Xử lý lại" (sau khi vaultLock đã được tạo bên dưới).
      isVaultLocked: () => vaultLock.isLocked(),
      // 116: đếm ghi cho bảo trì kho vector (bộ điều phối tạo bên dưới, sau vaultLock).
      onVectorWrite: () => vectorMaintenance?.notifyWrite(),
    });

    // 049 (2a-player): phục vụ file audio gốc cho <audio> qua iv-media:// (đọc file CHỈ main, tra sourceId→
    // path từ DB, chỉ nguồn kind=audio). Local: không egress.
    protocol.handle("iv-media", createMediaHandler(ingestion.sourceRepo));

    // chat-history (027): lưu bền hội thoại theo notebook (migration #4).
    const chatRepo = createChatRepo(db);
    // 055: keyword store BM25 (FTS5, migration #7) — cùng DB SQLite.
    const keywordStore = createKeywordStore(db);

    // rag-qa (013): hỏi đáp theo nguồn. embed/chat qua provider active (007); search/getChunks (011).
    // 027: persist mỗi lượt qua chatRepo.saveTurn (best-effort, không log nội dung).
    // 059: trạng thái tái lập chỉ mục (đổi engine embedding). rag:ask báo "đang tái lập" khi inProgress.
    const reindex: ReindexStatus = { inProgress: false, done: 0, total: 0 };

    // 098 (ADR online-fallback-clarify): đích AI theo lượt — "local" lấy thẳng Ollama, không đổi provider đang bật.
    const pickProvider = (target: AiTarget) =>
      pickProviderFor(aiRuntime.registry, target);
    // 105 (review S5): CÙNG num_ctx cho mọi lượt chat Ollama (hỏi đáp + Studio). Ollama nạp lại model khi num_ctx đổi
    // ⇒ dùng chung tránh nạp lại mỗi lần chuyển Chat ↔ Studio; hỏi đáp cũng không bị cắt ở cửa sổ mặc định nhỏ.
    const chatNumCtx = async (
      target: AiTarget,
    ): Promise<number | undefined> => {
      const p = pickProvider(target);
      if (p.id !== "ollama") return undefined;
      const tokens = (await p.contextTokens?.().catch(() => null)) ?? null;
      return numCtxFor(tokens) ?? undefined;
    };

    const makeRagService = (target: AiTarget) =>
      createRagService({
        // 059: embed CÂU TRUY VẤN in-process (e5 query) — thay Ollama. Dùng CHUNG embedder với ingestion
        // (passage) → cùng không gian vector, nhất quán index. Không cần Ollama cho embed.
        embed: async (text) =>
          (await ingestion.embedder.embed([text], "query"))[0],
        // 059 PER-NOTEBOOK (research R4): chỉ chặn notebook CHƯA nhúng đủ vector. Notebook đã xong (số vector =
        // số chunk) hỏi đáp bình thường dù reindex toàn cục còn chạy. Notebook rỗng (0 chunk) → không chặn.
        reindexing: async (nb) => {
          if (!reindex.inProgress) return false;
          const chunks = ingestion.sourceRepo.countChunksByNotebook(nb);
          if (chunks === 0) return false;
          const vectors = await ingestion.vectorStore.countByNotebook(nb);
          return vectors < chunks;
        },
        search: (v, nb, k) => ingestion.vectorStore.search(v, nb, k),
        getChunksByIds: (ids) => ingestion.sourceRepo.getChunksByIds(ids),
        sourceTitle: (sid) =>
          ingestion.sourceRepo.getById(sid)?.title ?? "Nguồn",
        // 055 hybrid: BM25 keyword (FTS5) + vector cho MMR. rewrite qua provider active (badge egress 031).
        searchBm25: (nb, query, k) => keywordStore.searchBm25(nb, query, k),
        getVectorsByIds: (ids) => ingestion.vectorStore.getVectorsByIds(ids),
        rewrite: (question, history) =>
          rewriteQuery(
            question,
            history,
            async (messages) =>
              (
                await pickProvider(target).chat({
                  messages,
                  numCtx: await chatNumCtx(target),
                })
              ).content,
          ),
        chat: async (messages) =>
          (
            await pickProvider(target).chat({
              messages,
              numCtx: await chatNumCtx(target),
            })
          ).content,
        // Streaming (039): cùng provider active, truyền onToken/signal xuống chat.
        chatStream: async (messages, opts) =>
          (
            await pickProvider(target).chat(
              { messages, numCtx: await chatNumCtx(target) },
              opts,
            )
          ).content,
        saveTurn: (nb, userContent, assistant) =>
          chatRepo.saveTurn(nb, userContent, assistant),
      });
    // 098: bản "active" (provider đang bật) + bản "local" (Ollama cho MỌI lệnh LLM, kể cả rewrite) — người dùng
    // bấm "Trả lời bằng AI cục bộ" sau lỗi online. Provider chọn LÚC GỌI ⇒ đổi provider trong Cài đặt có hiệu lực ngay.
    const ragServices = {
      active: makeRagService("active"),
      local: makeRagService("local"),
    };

    // studio (021): tổng hợp toàn notebook. Gom chunk qua source-repo (011), chat qua provider active (007),
    // lưu bền vào studio_result (migration #3). KHÔNG log nội dung.
    const makeStudioService = (target: AiTarget) =>
      createStudioService({
        listSources: (nb) => ingestion.sourceRepo.listByNotebook(nb),
        listChunks: (sid) => ingestion.sourceRepo.listChunks(sid),
        studioRepo: createStudioRepo(db),
        chat: async (messages, o) =>
          (await pickProvider(target).chat({ messages, numCtx: o?.numCtx }))
            .content,
        // 105: ngân sách + num_ctx theo cửa sổ ngữ cảnh của model đang dùng (ADR studio-large-clarify).
        contextInfo: async () => {
          const p = pickProvider(target);
          const tokens = (await p.contextTokens?.().catch(() => null)) ?? null;
          return studioContextFor(p.id, tokens);
        },
      });
    const studioServices = {
      active: makeStudioService("active"),
      local: makeStudioService("local"),
    };

    // content-search (073): tìm toàn văn nội dung nguồn (BM25 FTS5) → chunk → ContentSearchHit. Chỉ đọc.
    const contentSearch = createContentSearch({
      searchBm25: (nb, query, k) => keywordStore.searchBm25(nb, query, k),
      getChunksByIds: (ids) => ingestion.sourceRepo.getChunksByIds(ids),
      getSourceTitle: (sid) =>
        ingestion.sourceRepo.getById(sid)?.title ?? "Nguồn",
    });

    // 085 vault-backup: busy = nguồn queued/processing hoặc reindex nền; khoá chặn ghi lúc chụp/sau xác nhận.
    const vaultLock = createVaultLock({
      hasActiveSources: () =>
        ingestion.sourceRepo.listByStatus("queued").length > 0 ||
        ingestion.sourceRepo.listByStatus("processing").length > 0 ||
        // 112: "Xử lý lại" giữ nguồn ở `ready` ⇒ phải hỏi pipeline (đang ghi vector/chunk mới).
        ingestion.pipeline.isReprocessing(),
      isReindexing: () => reindex.inProgress,
    });
    // 116: bảo trì kho vector ngầm (gộp fragment + dọn phiên bản cũ) — chỉ chạy khi kho yên (isVaultBusy),
    // không UI/IPC; quan sát qua main.log (vector.maintenance.*). Chỉ đo kích thước/dung lượng trống, không đọc nội dung.
    const vectorsDir = join(dataDir.path, "vectors");
    const fsOps = createFsOps();
    vectorMaintenance = createVectorMaintenance({
      store: ingestion.vectorStore,
      isBusy: () => isVaultBusy(vaultLock),
      freeBytes: async () => {
        const st = await fsOps.statfs(dataDir.path);
        return st.bavail * st.bsize;
      },
      storeBytes: () => dirSize(vectorsDir, fsOps),
      now: () => Date.now(),
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as NodeJS.Timeout),
      log: logEvent,
      logError,
    });
    const maintenance = vectorMaintenance;
    app.on("will-quit", () => maintenance.dispose());
    const backupService = createBackupService({
      dataDir: dataDir.path,
      db,
      appVersion: app.getVersion(),
      getConfig: () => ({ ...(store.store as Record<string, unknown>) }),
      lock: vaultLock,
      dialogs: createElectronDialogs(),
      emit: (p) => {
        for (const w of BrowserWindow.getAllWindows()) {
          if (!w.isDestroyed()) w.webContents.send(CHANNELS.backupProgress, p);
        }
      },
      relaunch: () => {
        // E2E (chỉ khi CHƯA đóng gói): thoát mà không tự mở lại — test tự khởi chạy lại trên cùng userData
        // (tiến trình relaunch mồ côi sẽ giữ single-instance lock).
        if (!(process.env.IV_E2E_NO_RELAUNCH === "1" && !app.isPackaged)) {
          app.relaunch();
        }
        endSession(); // app.exit không phát will-quit — khởi động lại sau khôi phục là thoát sạch (093)
        app.exit(0);
      },
      log: logEvent,
      // 116: không chụp vectors/ giữa lúc bảo trì kho vector đang chạy.
      waitVectorIdle: () => maintenance.whenIdle(BACKUP_WAIT_TIMEOUT_MS),
    });

    // Renderer reload/crash giữa phiên khôi phục ⇒ huỷ phiên để nút không kẹt "bận" (code review S1).
    app.on("web-contents-created", (_e, contents) => {
      const abandon = (): void => void backupService.abandonRestore();
      contents.on("did-start-loading", abandon);
      contents.on("render-process-gone", abandon);
    });

    // 093: báo lỗi opt-in — soạn bản nháp từ nhật ký, mở GitHub issue điền sẵn (người dùng tự gửi). Lần chạy đầu
    // (chưa có mốc) lấy "bây giờ" làm mốc ⇒ dump có sẵn từ trước không bị báo là crash "mới".
    if (store.get("crashReport.ackedAt") === undefined) {
      store.set("crashReport.ackedAt", Date.now());
    }
    const crashService = createCrashService({
      env: {
        appVersion: app.getVersion(),
        electronVersion: process.versions.electron,
        platform: process.platform,
        arch: process.arch,
        osRelease: release(),
      },
      home: homedir(),
      abnormalExit,
      readLogLines: () => (logsDir ? readLogTail(logsDir, 400) : []),
      listDumps: () => listCrashDumps(app.getPath("crashDumps")),
      getAckedAt: () =>
        (store.get("crashReport.ackedAt") as number | undefined) ?? 0,
      setAckedAt: (ms) => store.set("crashReport.ackedAt", ms),
      openExternal: (url) => shell.openExternal(url),
      now: Date.now,
      log: logEvent,
    });

    registerIpc({
      store,
      uiLanguage,
      version: app.getVersion(),
      dataDir,
      notebookRepo,
      sourceRepo: ingestion.sourceRepo,
      pipeline: ingestion.pipeline,
      vectorStore: ingestion.vectorStore,
      aiRuntime,
      ragServices,
      chatRepo,
      studioServices,
      contentSearch,
      // 059 — gợi ý model theo RAM (thuần) + health Ollama (ping + /api/tags) + trạng thái reindex.
      recommendChatModel: () => recommendChatModel(totalmem()),
      ollamaHealth: () =>
        checkOllama({
          ping: async () => (await aiRuntime.getRuntimeStatus()).reachable,
          listModels: () => aiRuntime.listModels(),
          selectedChatModel: () =>
            aiRuntime.getSelectedModels().chatModel ?? undefined,
        }),
      reindexStatus: () => reindex,
      backupService,
      vaultLock,
      logsDir,
      crashService,
      // 101: chọn lại tệp gốc — hộp thoại ở main + kiểm cùng nội dung (cùng hàm băm lúc nạp).
      relinkSource: createRelink({
        repo: ingestion.sourceRepo,
        pickFile: pickSourceFile,
        hashFile: hashFileStreaming,
        realpath: (p) => realpath(p),
        isLocked: () => vaultLock.isLocked(),
        log: logEvent,
      }),
      // 112: xử lý lại PDF — kiểm tệp gốc còn + cùng nội dung (cùng hàm băm lúc nạp) rồi xếp hàng.
      reprocessSource: createReprocessRequest({
        repo: ingestion.sourceRepo,
        pipeline: ingestion.pipeline,
        isVaultLocked: () => vaultLock.isLocked(),
        fileExists: async (p) => existsSync(p),
        hashFile: hashFileStreaming,
      }),
    });

    // 123: đẩy ngôn ngữ giao diện mới tới mọi cửa sổ — renderer re-render ngay, không khởi động lại (FR-004).
    uiLanguage.onChange((state) => {
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed())
          w.webContents.send(CHANNELS.uiLanguageChanged, state);
      }
    });

    // 103: đẩy trạng thái riêng tư mới tới mọi cửa sổ mỗi khi mode đổi (badge cập nhật tức thì — Constitution I).
    onPrivacyChange((state) => {
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed())
          w.webContents.send(CHANNELS.privacyChanged, state);
      }
    });

    installSecurity();
    createWindow();

    // Phục hồi trạng thái nguồn dở từ phiên trước:
    // - queued/processing (kẹt do đóng/crash giữa chừng) → error retry được (B3).
    // - awaiting_embedding → tự nhúng tiếp khi runtime AI sẵn sàng (US4, FR-009).
    ingestion.pipeline.resumeInterrupted();
    void ingestion.pipeline.resumeAwaiting();
    // 116: một lần bắt kịp sau khởi động (vault cũ chưa từng bảo trì) — trễ, không chặn cửa sổ.
    maintenance.scheduleStartup();

    // 059: tái lập chỉ mục NỀN nếu đổi engine embedding (version lệch). Không chặn khởi động. Idempotent +
    // resume (bỏ chunk đã có vector). Trong lúc chạy, rag:ask báo "đang tái lập" (reindex.inProgress).
    const storedVersion = store.get("embeddingModelVersion") as
      string | undefined;
    if (needsReindex(storedVersion)) {
      reindex.inProgress = true;
      const emitReindex = (): void => {
        for (const w of BrowserWindow.getAllWindows()) {
          if (!w.isDestroyed()) {
            w.webContents.send(CHANNELS.embedReindexProgress, {
              inProgress: reindex.inProgress,
              done: reindex.done,
              total: reindex.total,
            });
          }
        }
      };
      void runReindex({
        listAllChunkRefs: () => ingestion.sourceRepo.allChunkRefs(),
        getChunkTexts: (ids) =>
          new Map(
            ingestion.sourceRepo.getChunksByIds(ids).map((c) => [c.id, c.text]),
          ),
        embedPassage: (texts) => ingestion.embedder.embed(texts, "passage"),
        vectorStore: ingestion.vectorStore,
        readVersion: () =>
          store.get("embeddingModelVersion") as string | undefined,
        writeVersion: (v) => store.set("embeddingModelVersion", v),
        onProgress: (done, total) => {
          reindex.done = done;
          reindex.total = total;
          emitReindex();
        },
      })
        // KHÔNG log message/String(e) thô (key 'message' không được redact — có thể dính nội dung chunk từ
        // lib); chỉ log loại lỗi (Constitution III).
        .catch((e) =>
          logEvent("embed.reindex.error", {
            errorType: e instanceof Error ? e.constructor.name : typeof e,
          }),
        )
        .finally(() => {
          reindex.inProgress = false;
          emitReindex();
          // 116: reindex ghi rất nhiều lô nhỏ ⇒ gộp ngay khi kho yên.
          maintenance.notifyReindexDone();
        });
    }
    // Lưu ý: cài mới (chưa có chunk) → needsReindex=true nhưng runReindex chạy tức thì (0 chunk) rồi bump
    // version → lần sau "done".

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  // Bắt mọi lỗi khởi động (migration/DB/native…) → dialog + thoát sạch thay vì unhandled rejection âm thầm.
  .catch(handleFatalStartup);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
