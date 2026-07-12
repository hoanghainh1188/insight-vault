import { writeFile } from "node:fs/promises";
import { dialog, type BrowserWindow } from "electron";
import type { StudioExportResult } from "@shared/ipc/types";
import { sanitizeName } from "./export-name";

// Xuất kết quả Studio ra tệp .md (025). Ghi file CHỈ ở main qua hộp thoại lưu người dùng chủ động chọn
// (Constitution I/III — không tự ghi/gửi, không egress). KHÔNG log nội dung. sanitizeName tách export-name.ts.

/**
 * Mở hộp thoại lưu + ghi nội dung ra .md. Huỷ → {saved:false}. KHÔNG log content.
 * `win` có thể null → dialog không parent (vẫn hoạt động).
 */
export async function exportMarkdown(
  win: BrowserWindow | null,
  content: string,
  suggestedName: string,
): Promise<StudioExportResult> {
  // Validate tại biên IPC (defense-in-depth): chỉ nhận chuỗi.
  if (typeof content !== "string" || typeof suggestedName !== "string") {
    throw new Error("Yêu cầu xuất tệp không hợp lệ.");
  }
  const defaultPath = `${sanitizeName(suggestedName)}.md`;
  const result = win
    ? await dialog.showSaveDialog(win, {
        defaultPath,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      })
    : await dialog.showSaveDialog({
        defaultPath,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });

  if (result.canceled || !result.filePath) {
    return { saved: false };
  }
  await writeFile(result.filePath, content, "utf8");
  return { saved: true, path: result.filePath };
}
