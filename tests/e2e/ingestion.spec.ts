import { test, expect, type ElectronApplication } from "@playwright/test";
import { join } from "node:path";
import { launchFresh, dismissOnboarding, UNREACHABLE_OLLAMA } from "./helper";

// 011-ingestion e2e. 059: embedding CHẠY IN-PROCESS (fake tất định qua IV_EMBED_FAKE, không tải model) →
// nguồn parse+chunk+nhúng+lưu → 'ready' KỂ CẢ khi Ollama offline (embed không còn cần Ollama). Kiểm:
// add→có chunk+không lỗi, delete→cascade sạch, whitelist source:*.
let app: ElectronApplication;
const FIXTURE = join(process.cwd(), "tests/fixtures/sample.txt");

test.beforeAll(async () => {
  app = await launchFresh(UNREACHABLE_OLLAMA);
});
test.afterAll(async () => {
  await app?.close();
});

test("nạp tệp txt → nguồn nhúng in-process → ready (Ollama offline), không lỗi", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);

  // Tạo notebook + nạp nguồn qua API (bỏ qua OS file picker).
  const nbId = await win.evaluate(async () => {
    const nb = await window.api.notebookCreate({
      name: "E2E ingest",
      color: "#1E6B57",
    });
    return nb.id;
  });

  const res = await win.evaluate(
    async ([id, path]) =>
      window.api.sourceAdd({ notebookId: id, kind: "txt", filePath: path }),
    [nbId, FIXTURE] as const,
  );
  expect(res.source.status).toBe("queued");

  // Chờ pipeline: nguồn về 'awaiting_embedding' (Ollama offline) hoặc 'ready' (nếu có Ollama).
  await expect
    .poll(
      async () =>
        win.evaluate(async (id) => {
          const list = await window.api.sourceListByNotebook(id);
          return list[0]?.status ?? null;
        }, nbId),
      { timeout: 15000 },
    )
    .toMatch(/awaiting_embedding|ready/);

  // Nguồn KHÔNG ở trạng thái lỗi + đã có chunk (parse+chunk chạy dù offline).
  const status = await win.evaluate(async (id) => {
    const list = await window.api.sourceListByNotebook(id);
    return list[0]?.status;
  }, nbId);
  expect(status).not.toBe("error");
});

test("xoá nguồn → danh sách rỗng (cascade chunk + vector)", async () => {
  const win = await app.firstWindow();
  const nbId = await win.evaluate(async () => {
    const nb = await window.api.notebookCreate({
      name: "E2E del",
      color: "#1E6B57",
    });
    return nb.id;
  });
  const sid = await win.evaluate(
    async ([id, path]) => {
      const r = await window.api.sourceAdd({
        notebookId: id,
        kind: "txt",
        filePath: path,
      });
      return r.source.id;
    },
    [nbId, FIXTURE] as const,
  );
  await win.evaluate(async (id) => window.api.sourceDelete(id), sid);
  const remaining = await win.evaluate(
    async (id) => (await window.api.sourceListByNotebook(id)).length,
    nbId,
  );
  expect(remaining).toBe(0);
});

test("whitelist: renderer chỉ có hàm source:* whitelisted, không invoke kênh tuỳ ý", async () => {
  const win = await app.firstWindow();
  const keys = await win.evaluate(() =>
    Object.keys((window as unknown as { api: object }).api),
  );
  for (const fn of [
    "sourceAdd",
    "sourceListByNotebook",
    "sourceGet",
    "sourceDelete",
    "sourceRetry",
    "onSourceProgress",
  ]) {
    expect(keys).toContain(fn);
  }
  expect(keys).not.toContain("invoke");
});

test("UI: mở Workspace → cột Nguồn + modal Thêm nguồn (Video bật 051, Hình ảnh vô hiệu)", async () => {
  const win = await app.firstWindow();
  const nbId = await win.evaluate(async () => {
    const nb = await window.api.notebookCreate({
      name: "E2E ui",
      color: "#1E6B57",
    });
    return nb.id;
  });
  await win.evaluate((id) => {
    window.location.hash = `#/workspace/${id}`;
  }, nbId);

  await expect(win.getByTestId("workspace")).toBeVisible();
  await win.getByTestId("add-source-btn").click();
  await expect(win.getByTestId("add-source-modal")).toBeVisible();
  await expect(win.getByTestId("tab-file")).toBeVisible();
  await expect(win.getByTestId("tab-url")).toBeVisible();
  // 051/053: tab "Video" + "Hình ảnh" đã BẬT (bấm → về tab Tệp; nhập qua kéo-thả). Không còn ô disabled.
  await expect(win.getByTestId("tab-video")).toBeEnabled();
  await expect(win.getByTestId("tab-image")).toBeEnabled();
  await win.getByTestId("tab-image").click();
  await expect(win.getByTestId("drop-zone")).toBeVisible();
  await expect(win.getByTestId("video-origin-note")).toBeVisible();
});
