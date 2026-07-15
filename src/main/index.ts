import { join } from "node:path";
import { existsSync } from "node:fs";
import {
  app,
  BrowserWindow,
  dialog,
  nativeImage,
  protocol,
  session,
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
import { setEgressActive } from "./services/app-shell/privacy-state";
import { startupErrorDialog } from "./services/app-shell/startup-error";
import { createMediaHandler } from "./services/source-viewer/media-serve";
import { logEvent } from "./logging";
import { runReindex, needsReindex } from "./services/embedding/reindex-runner";
import { recommendChatModel } from "./services/ai/model-recommend";
import { checkOllama } from "./services/ai/ollama-health";
import type { ReindexStatus } from "@shared/ipc/types";
import { totalmem } from "node:os";

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
let fatalHandled = false;
function handleFatalStartup(err: unknown): void {
  if (fatalHandled) return;
  const { title, detail, errorType } = startupErrorDialog(err);
  logEvent("startup.error", { errorType });
  // Chốt một chiều: chỉ THOÁT nếu chưa từng dựng cửa sổ (giai đoạn khởi động). Không dùng số cửa sổ
  // hiện tại vì trên macOS đóng hết cửa sổ KHÔNG thoát app (idle ở dock) → sẽ về 0 và hiểu nhầm lỗi
  // runtime muộn là lỗi khởi động rồi giết phiên người dùng. Sau khi UI đã lên, lỗi muộn chỉ log.
  if (everShownWindow) return;
  fatalHandled = true;
  dialog.showErrorBox(title, detail);
  app.quit();
}

process.on("uncaughtException", handleFatalStartup);
process.on("unhandledRejection", handleFatalStartup);

app
  .whenReady()
  .then(async () => {
    // Icon dock macOS: bản đóng gói lấy từ bundle .icns; khi DEV thì phải set thủ công (nếu không → icon
    // Electron mặc định). Không lỗi nếu thiếu file/không phải macOS.
    if (process.platform === "darwin" && app.dock) {
      const ic = resolveIconPath();
      if (ic) app.dock.setIcon(nativeImage.createFromPath(ic));
    }
    // Đảm bảo data dir tồn tại (FR-011/012). userData = chuẩn OS (F1).
    const dataDir = await ensureDataDir(app.getPath("userData"));
    if (!dataDir.ready) {
      logEvent("datadir.error", { path: dataDir.path });
      dialog.showErrorBox(
        "Không tạo được thư mục dữ liệu",
        `InsightVault không thể tạo thư mục dữ liệu tại:\n${dataDir.path}\n\nKiểm tra quyền truy cập hoặc dung lượng ổ đĩa rồi mở lại ứng dụng.`,
      );
      app.quit();
      return;
    }

    const store = new Store();

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
    const ingestion = await createIngestion({
      db,
      dataDir: dataDir.path,
      aiRuntime,
      emit: emitProgress,
      setOnline: (online) => setEgressActive(online), // bật chỉ báo online khi fetch URL (FR-019)
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

    const ragService = createRagService({
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
      sourceTitle: (sid) => ingestion.sourceRepo.getById(sid)?.title ?? "Nguồn",
      // 055 hybrid: BM25 keyword (FTS5) + vector cho MMR. rewrite qua provider active (badge egress 031).
      searchBm25: (nb, query, k) => keywordStore.searchBm25(nb, query, k),
      getVectorsByIds: (ids) => ingestion.vectorStore.getVectorsByIds(ids),
      rewrite: (question, history) =>
        rewriteQuery(
          question,
          history,
          async (messages) =>
            (await aiRuntime.registry.getActive().chat({ messages })).content,
        ),
      chat: async (messages) =>
        (await aiRuntime.registry.getActive().chat({ messages })).content,
      // Streaming (039): cùng provider active, truyền onToken/signal xuống chat.
      chatStream: async (messages, opts) =>
        (await aiRuntime.registry.getActive().chat({ messages }, opts)).content,
      saveTurn: (nb, userContent, assistant) =>
        chatRepo.saveTurn(nb, userContent, assistant),
    });

    // studio (021): tổng hợp toàn notebook. Gom chunk qua source-repo (011), chat qua provider active (007),
    // lưu bền vào studio_result (migration #3). KHÔNG log nội dung.
    const studioService = createStudioService({
      listSources: (nb) => ingestion.sourceRepo.listByNotebook(nb),
      listChunks: (sid) => ingestion.sourceRepo.listChunks(sid),
      studioRepo: createStudioRepo(db),
      chat: async (messages) =>
        (await aiRuntime.registry.getActive().chat({ messages })).content,
    });

    // content-search (073): tìm toàn văn nội dung nguồn (BM25 FTS5) → chunk → ContentSearchHit. Chỉ đọc.
    const contentSearch = createContentSearch({
      searchBm25: (nb, query, k) => keywordStore.searchBm25(nb, query, k),
      getChunksByIds: (ids) => ingestion.sourceRepo.getChunksByIds(ids),
      getSourceTitle: (sid) =>
        ingestion.sourceRepo.getById(sid)?.title ?? "Nguồn",
    });

    registerIpc({
      store,
      version: app.getVersion(),
      dataDir,
      notebookRepo,
      sourceRepo: ingestion.sourceRepo,
      pipeline: ingestion.pipeline,
      vectorStore: ingestion.vectorStore,
      aiRuntime,
      ragService,
      chatRepo,
      studioService,
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
    });

    installSecurity();
    createWindow();

    // Phục hồi trạng thái nguồn dở từ phiên trước:
    // - queued/processing (kẹt do đóng/crash giữa chừng) → error retry được (B3).
    // - awaiting_embedding → tự nhúng tiếp khi runtime AI sẵn sàng (US4, FR-009).
    ingestion.pipeline.resumeInterrupted();
    void ingestion.pipeline.resumeAwaiting();

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
