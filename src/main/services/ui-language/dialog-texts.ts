import type { Translator } from "@shared/i18n";

// 123 (FR-008, T055): tiêu đề + tên bộ lọc của hộp thoại hệ thống do main mở — hàm THUẦN (test được); adapter Electron
// (vault-backup/dialogs.ts, ingestion/relink-dialog.ts, studio/export.ts) chỉ ghép vào options.

export interface FileFilter {
  name: string;
  extensions: string[];
}

export function backupDialogTexts(tr: Translator): {
  saveTitle: string;
  openTitle: string;
  filters: FileFilter[];
} {
  return {
    saveTitle: tr.t("dialogs.backup.title"),
    openTitle: tr.t("dialogs.restore.title"),
    filters: [
      { name: tr.t("dialogs.backup.filter"), extensions: ["ivbackup"] },
    ],
  };
}

export function relinkDialogTexts(
  tr: Translator,
  extensions: string[],
): { title: string; filters: FileFilter[] } {
  return {
    title: tr.t("dialogs.relink.title"),
    filters: [{ name: tr.t("dialogs.relink.filter"), extensions }],
  };
}

export function exportDialogFilters(tr: Translator): FileFilter[] {
  return [{ name: tr.t("dialogs.export.filter"), extensions: ["md"] }];
}
