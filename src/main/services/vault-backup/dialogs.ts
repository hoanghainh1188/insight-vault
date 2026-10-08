import { app, BrowserWindow, dialog } from "electron";
import type { Translator } from "@shared/i18n";
import type { BackupDialogs } from "./backup-service";
import { backupDialogTexts } from "../ui-language/dialog-texts";

// Adapter hộp thoại Electron cho sao lưu/khôi phục (085). Đường dẫn file CHỈ đến từ đây (main) — renderer không
// gửi path. `IV_E2E_DIALOG_PATH` (chỉ khi CHƯA đóng gói, cùng cách gác như IV_EMBED_FAKE) thay hộp thoại native
// cho E2E; bản đóng gói luôn dùng hộp thoại thật. Loại khỏi coverage (I/O Electron).

function e2ePath(): string | null | undefined {
  if (app.isPackaged) return undefined;
  const v = process.env.IV_E2E_DIALOG_PATH;
  if (v === undefined) return undefined;
  return v === "" ? null : v; // "" ⇒ mô phỏng người dùng huỷ
}

export function createElectronDialogs(
  translator: () => Translator,
): BackupDialogs {
  return {
    async chooseSavePath(defaultName) {
      const fake = e2ePath();
      if (fake !== undefined) return fake;
      const win = BrowserWindow.getFocusedWindow();
      // 123: tiêu đề + bộ lọc theo ngôn ngữ giao diện lúc mở hộp thoại.
      const texts = backupDialogTexts(translator());
      const opts = {
        title: texts.saveTitle,
        defaultPath: defaultName,
        filters: texts.filters,
      };
      const r = win
        ? await dialog.showSaveDialog(win, opts)
        : await dialog.showSaveDialog(opts);
      if (r.canceled || !r.filePath) return null;
      return r.filePath.endsWith(".ivbackup")
        ? r.filePath
        : `${r.filePath}.ivbackup`;
    },
    async chooseOpenPath() {
      const fake = e2ePath();
      if (fake !== undefined) return fake;
      const win = BrowserWindow.getFocusedWindow();
      const texts = backupDialogTexts(translator());
      const opts = {
        title: texts.openTitle,
        filters: texts.filters,
        properties: ["openFile" as const],
      };
      const r = win
        ? await dialog.showOpenDialog(win, opts)
        : await dialog.showOpenDialog(opts);
      return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0];
    },
  };
}
