import { app, BrowserWindow, dialog } from "electron";
import type { Translator } from "@shared/i18n";

// 101 — hộp thoại chọn lại tệp gốc (I/O Electron, loại khỏi coverage). `IV_E2E_DIALOG_PATH` (chỉ khi CHƯA đóng gói,
// như 085) thay hộp thoại native cho E2E; "" ⇒ mô phỏng huỷ.
export async function pickSourceFile(
  opts: {
    defaultDir: string;
    extensions: string[];
  },
  tr: Translator,
): Promise<string | null> {
  if (!app.isPackaged && process.env.IV_E2E_DIALOG_PATH !== undefined) {
    const v = process.env.IV_E2E_DIALOG_PATH;
    return v === "" ? null : v;
  }
  const win = BrowserWindow.getFocusedWindow();
  const o = {
    title: tr.t("dialogs.relink.title"),
    defaultPath: opts.defaultDir,
    filters: [
      { name: tr.t("dialogs.relink.filter"), extensions: opts.extensions },
    ],
    properties: ["openFile" as const],
  };
  const r = win
    ? await dialog.showOpenDialog(win, o)
    : await dialog.showOpenDialog(o);
  return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0];
}
