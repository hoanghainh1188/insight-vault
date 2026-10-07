import { test, expect, type ElectronApplication } from "@playwright/test";
import { copyFile, mkdir, mkdtemp, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launchFresh, dismissOnboarding } from "./helper";

// 101 — chọn lại tệp gốc trên app thật: tệp gốc bị di chuyển ⇒ chọn tệp KHÁC nội dung bị từ chối (trích dẫn sẽ sai),
// chọn đúng tệp ở chỗ mới thì nhận. Hộp thoại native thay bằng IV_E2E_DIALOG_PATH (chỉ khi chưa đóng gói).
// Cần `npm run build` trước.

let app: ElectronApplication;
let dir: string;
let picked: string;

test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "iv-relink-"));
  picked = join(dir, "da-chuyen", "ghi-chu.txt");
  app = await launchFresh({ IV_E2E_DIALOG_PATH: picked });
});
test.afterAll(async () => {
  await app?.close();
});

test("tệp gốc bị di chuyển: tệp khác nội dung bị từ chối, đúng tệp thì nhận", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);
  const original = join(dir, "ghi-chu.txt");
  await copyFile(join(process.cwd(), "tests/fixtures/sample.txt"), original);

  const nbId = await win.evaluate(async () => {
    const nb = await window.api.notebookCreate({
      name: "E2E relink",
      color: "#1E6B57",
    });
    return nb.id;
  });
  const sourceId = await win.evaluate(
    async ([id, p]) =>
      (await window.api.sourceAdd({ notebookId: id, kind: "txt", filePath: p }))
        .source.id,
    [nbId, original] as const,
  );
  await expect
    .poll(async () =>
      win.evaluate(
        async (id) => (await window.api.sourceGet(id))?.status,
        sourceId,
      ),
    )
    .toBe("ready");

  // Người dùng chuyển tệp sang thư mục khác; ở chỗ "chọn" ban đầu là một tệp KHÁC nội dung.
  await mkdir(join(dir, "da-chuyen"));
  await writeFile(picked, "nội dung khác hẳn");
  const mismatch = await win.evaluate(
    (id) => window.api.sourceRelink(id),
    sourceId,
  );
  expect(mismatch).toEqual({ status: "mismatch" });

  // Chọn đúng tệp gốc (đã chuyển chỗ) ⇒ nhận.
  await rename(original, picked);
  const ok = await win.evaluate((id) => window.api.sourceRelink(id), sourceId);
  expect(ok).toEqual({ status: "ok" });

  // Nguồn vẫn sẵn sàng (liên kết lại không đụng chunk/trích dẫn).
  expect(
    await win.evaluate(
      async (id) => (await window.api.sourceGet(id))?.status,
      sourceId,
    ),
  ).toBe("ready");
});

test("whitelist: window.api.sourceRelink chỉ nhận id (không có hàm đặt đường dẫn)", async () => {
  const win = await app.firstWindow();
  const keys = await win.evaluate(() => Object.keys(window.api));
  expect(keys).toContain("sourceRelink");
  expect(keys.some((k) => /setOrigin|relinkPath/i.test(k))).toBe(false);
});
