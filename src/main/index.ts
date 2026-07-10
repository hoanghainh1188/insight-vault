import { join } from "node:path";
import { app, BrowserWindow, dialog, session } from "electron";
import Store from "electron-store";
import { ensureDataDir } from "./services/app-shell/data-dir";
import { registerIpc } from "./ipc/register";
import { logEvent } from "./logging";

// Hardening cấp session (Constitution I & III): từ chối mọi permission request (app-shell không cần
// camera/mic/geo/…); chặn mở device (USB/HID/serial). Local-first: không có bề mặt xin quyền nào.
function installSecurity(): void {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  ses.setPermissionCheckHandler(() => false);
  ses.setDevicePermissionHandler(() => false);
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1120,
    height: 720,
    minWidth: 720,
    minHeight: 480,
    show: false,
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
  registerIpc({ store, version: app.getVersion(), dataDir });

  installSecurity();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
