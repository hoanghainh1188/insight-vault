import { coreVi } from "./domains/core";
import { appVi } from "./domains/app";
import { notebooksVi } from "./domains/notebooks";
import { searchVi } from "./domains/search";
import { sourcesVi } from "./domains/sources";
import { viewerVi } from "./domains/viewer";
import { chatVi } from "./domains/chat";
import { studioVi } from "./domains/studio";
import { aiVi } from "./domains/ai";
import { backupVi } from "./domains/backup";
import { crashVi } from "./domains/crash";
import { dialogsVi } from "./domains/dialogs";
import { a11yVi } from "./domains/a11y";

// 123 — tệp dịch NGÔN NGỮ NGUỒN (tiếng Việt), ghép từ các domain ở ./domains (mỗi domain một tệp để nhiều người
// sửa song song). Kiểu `Messages` suy từ đây; en.ts phải đủ khoá + cùng placeholder (tsc + i18n-catalog.test.ts).

export const vi = {
  ...coreVi,
  app: appVi,
  notebooks: notebooksVi,
  search: searchVi,
  sources: sourcesVi,
  viewer: viewerVi,
  chat: chatVi,
  studio: studioVi,
  ai: aiVi,
  backup: backupVi,
  crash: crashVi,
  dialogs: dialogsVi,
  a11y: a11yVi,
} as const;
