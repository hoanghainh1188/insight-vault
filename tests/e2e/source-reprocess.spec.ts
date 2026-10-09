import { test, expect, type ElectronApplication } from "@playwright/test";
import { appendFile, copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDF_EXTRACTION_VERSION } from "../../src/shared/ipc/types";
import { launchFresh, dismissOnboarding } from "./helper";

// 112 — "Xử lý lại" PDF trên app thật (IV_EMBED_FAKE=1 qua helper): kênh whitelisted chỉ nhận id; PDF nạp mới ghi
// phiên bản trích có bố cục; xử lý lại chạy xong vẫn sẵn sàng; tệp bị sửa ⇒ mismatch; tệp mất ⇒ missing.
// Cần `npm run build` trước.

let app: ElectronApplication;
let dir: string;

test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "iv-reprocess-"));
  app = await launchFresh();
});
test.afterAll(async () => {
  await app?.close();
});

test("whitelist: window.api có sourceReprocess/Cancel, không có hàm nhận đường dẫn", async () => {
  const win = await app.firstWindow();
  const keys = await win.evaluate(() => Object.keys(window.api));
  expect(keys).toContain("sourceReprocess");
  expect(keys).toContain("sourceReprocessCancel");
  expect(keys.some((k) => /reprocessPath|reprocessAll/i.test(k))).toBe(false);
});

test("PDF: nạp mới ⇒ phiên bản hiện hành; xử lý lại ⇒ vẫn sẵn sàng; tệp sửa ⇒ mismatch; tệp mất ⇒ missing", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);
  const pdf = join(dir, "bao-cao.pdf");
  await copyFile(join(process.cwd(), "tests/fixtures/sample.pdf"), pdf);

  const nbId = await win.evaluate(async () => {
    const nb = await window.api.notebookCreate({
      name: "E2E reprocess",
      color: "#1E6B57",
    });
    return nb.id;
  });
  const sourceId = await win.evaluate(
    async ([id, p]) =>
      (await window.api.sourceAdd({ notebookId: id, kind: "pdf", filePath: p }))
        .source.id,
    [nbId, pdf] as const,
  );
  const get = () => win.evaluate((id) => window.api.sourceGet(id), sourceId);
  await expect.poll(async () => (await get())?.status).toBe("ready");
  expect((await get())?.extractionVersion).toBe(PDF_EXTRACTION_VERSION);

  const before = (await get())!.updatedAt;
  expect(
    await win.evaluate((id) => window.api.sourceReprocess(id), sourceId),
  ).toEqual({
    status: "queued",
  });
  await expect
    .poll(async () => (await get())!.updatedAt)
    .toBeGreaterThan(before);
  expect((await get())?.status).toBe("ready");

  await appendFile(pdf, "\n% sua noi dung\n");
  expect(
    await win.evaluate((id) => window.api.sourceReprocess(id), sourceId),
  ).toEqual({
    status: "mismatch",
  });

  await rm(pdf);
  expect(
    await win.evaluate((id) => window.api.sourceReprocess(id), sourceId),
  ).toEqual({
    status: "missing",
  });
});
