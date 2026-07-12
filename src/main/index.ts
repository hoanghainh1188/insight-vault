import { join } from "node:path";
import { existsSync } from "node:fs";
import { app, BrowserWindow, dialog, nativeImage, session } from "electron";
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
import { createChatRepo } from "./services/rag/chat-repo";
import { createStudioRepo } from "./services/studio/studio-repo";
import { createStudioService } from "./services/studio/studio-service";
import { setEgressActive } from "./services/app-shell/privacy-state";
import { logEvent } from "./logging";

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

function createWindow(): void {
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

app.whenReady().then(async () => {
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

  // chat-history (027): lưu bền hội thoại theo notebook (migration #4).
  const chatRepo = createChatRepo(db);

  // rag-qa (013): hỏi đáp theo nguồn. embed/chat qua provider active (007); search/getChunks (011).
  // 027: persist mỗi lượt qua chatRepo.saveTurn (best-effort, không log nội dung).
  const ragService = createRagService({
    // Embedding LUÔN dùng Ollama local (031, quyết định #1) — nhất quán vector index bất kể provider
    // chat online đang active. Chat mới đi qua provider active (getActive).
    embed: async (text) => (await aiRuntime.embedLocal({ text })).vector,
    search: (v, nb, k) => ingestion.vectorStore.search(v, nb, k),
    getChunksByIds: (ids) => ingestion.sourceRepo.getChunksByIds(ids),
    sourceTitle: (sid) => ingestion.sourceRepo.getById(sid)?.title ?? "Nguồn",
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
  });

  installSecurity();
  createWindow();

  // Phục hồi trạng thái nguồn dở từ phiên trước:
  // - queued/processing (kẹt do đóng/crash giữa chừng) → error retry được (B3).
  // - awaiting_embedding → tự nhúng tiếp khi runtime AI sẵn sàng (US4, FR-009).
  ingestion.pipeline.resumeInterrupted();
  void ingestion.pipeline.resumeAwaiting();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
