import { test, expect, type ElectronApplication } from "@playwright/test";
import { launchFresh, dismissOnboarding, UNREACHABLE_OLLAMA } from "./helper";

// 025-workspace-enhance e2e (tất định, không cần Ollama). Phủ: whitelist studio:export · kéo splitter +
// persist · nav nhớ notebook. Sinh Studio đầy đủ (map-reduce đã bỏ; 1-lượt) cần Ollama → unit + thủ công.
let app: ElectronApplication;

test.beforeAll(async () => {
  app = await launchFresh(UNREACHABLE_OLLAMA);
});
test.afterAll(async () => await app?.close());

test("whitelist: window.api có studioExport, không invoke chung", async () => {
  const win = await app.firstWindow();
  const keys = await win.evaluate(() =>
    Object.keys((window as unknown as { api: object }).api),
  );
  expect(keys).toContain("studioExport");
  expect(keys).not.toContain("invoke");
});

test("kéo splitter cột Nguồn → đổi độ rộng + lưu localStorage", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);

  const nbId = await win.evaluate(async () => {
    const nb = await window.api.notebookCreate({
      name: "WS",
      color: "#1E6B57",
    });
    return nb.id;
  });
  await win.evaluate((id) => {
    window.location.hash = `#/workspace/${id}`;
  }, nbId);
  await expect(win.getByTestId("workspace")).toBeVisible();

  const splitter = win.getByTestId("splitter-src");
  const box = await splitter.boundingBox();
  if (!box) throw new Error("splitter-src không có boundingBox");
  await win.mouse.move(box.x + 2, box.y + 60);
  await win.mouse.down();
  await win.mouse.move(box.x + 70, box.y + 60, { steps: 5 });
  await win.mouse.up();

  const stored = await win.evaluate(() =>
    localStorage.getItem("workspace-col-widths"),
  );
  expect(stored).toBeTruthy();
  const parsed = JSON.parse(stored as string) as { src: number };
  expect(parsed.src).toBeGreaterThanOrEqual(220);
  expect(parsed.src).toBeLessThanOrEqual(460);
});

test("nav Workspace nhớ notebook gần nhất (bare /workspace → redirect)", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);

  const nbId = await win.evaluate(async () => {
    const nb = await window.api.notebookCreate({
      name: "Nhớ tôi",
      color: "#1E6B57",
    });
    return nb.id;
  });
  // Mở workspace của notebook → effect lưu last-notebook-id.
  await win.evaluate((id) => {
    window.location.hash = `#/workspace/${id}`;
  }, nbId);
  await expect(win.getByTestId("workspace")).toBeVisible();

  // Đi tới /workspace (bare) → placeholder tự redirect về notebook gần nhất.
  await win.evaluate(() => {
    window.location.hash = "#/workspace";
  });
  await expect
    .poll(async () => win.evaluate(() => location.hash), { timeout: 5000 })
    .toContain(`/workspace/${nbId}`);
});

test("nav Workspace: notebook gần nhất đã xoá → CTA chọn notebook", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);

  const nbId = await win.evaluate(async () => {
    const nb = await window.api.notebookCreate({
      name: "Sắp xoá",
      color: "#1E6B57",
    });
    return nb.id;
  });
  await win.evaluate((id) => {
    window.location.hash = `#/workspace/${id}`;
  }, nbId);
  await expect(win.getByTestId("workspace")).toBeVisible();

  // Xoá notebook (last-notebook-id giờ trỏ tới id không còn tồn tại).
  await win.evaluate((id) => window.api.notebookDelete(id), nbId);

  await win.evaluate(() => {
    window.location.hash = "#/workspace";
  });
  // KHÔNG redirect (notebook đã xoá) → hiện CTA chọn notebook.
  await expect(win.getByTestId("ws-pick")).toBeVisible();
});
