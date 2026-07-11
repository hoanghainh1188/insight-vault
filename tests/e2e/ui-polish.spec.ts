import { test, expect, type ElectronApplication } from "@playwright/test";
import { launchFresh, dismissOnboarding, UNREACHABLE_OLLAMA } from "./helper";

// 023-ui-polish e2e (tất định, không cần Ollama). Phủ: NavRail aria-label + điều hướng · empty/no-result
// Notebooks · modal a11y (aria-modal + Escape + nút X). Chip màu citation + composer (model chip/send) +
// bubble cần câu trả lời LLM → phủ bằng ảnh chụp thủ công (tiền lệ source-viewer/studio).
let app: ElectronApplication;

test.beforeAll(async () => {
  app = await launchFresh(UNREACHABLE_OLLAMA);
});
test.afterAll(async () => await app?.close());

test("NavRail: mỗi mục có aria-label + điều hướng đúng khu vực", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);

  for (const [id, label] of [
    ["nav-notebooks", "Notebooks"],
    ["nav-workspace", "Workspace"],
    ["nav-settings", "Cài đặt"],
  ] as const) {
    await expect(win.getByTestId(id)).toHaveAttribute("aria-label", label);
  }
  await win.getByTestId("nav-settings").click();
  expect(await win.evaluate(() => location.hash)).toContain("/settings");
  await win.getByTestId("nav-notebooks").click();
  expect(await win.evaluate(() => location.hash)).toContain("/notebooks");
});

test("Notebooks: empty state khi chưa có notebook", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);
  await win.getByTestId("nav-notebooks").click();
  await expect(win.getByTestId("notebooks-empty")).toBeVisible();
});

test("Notebooks: no-result khi tìm không khớp", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);
  await win.getByTestId("nav-notebooks").click();

  // Tạo 1 notebook rồi tìm chuỗi không khớp.
  await win.getByTestId("notebook-new").click();
  await win.getByTestId("notebook-name-input").fill("Hồ sơ A");
  await win.getByTestId("notebook-submit").click();
  await expect(win.getByTestId("notebook-modal")).toBeHidden();

  await win.getByTestId("notebook-search").fill("zzz-khong-khop");
  await expect(win.getByTestId("notebooks-no-result")).toBeVisible();
  await win.getByTestId("notebook-search").fill("");
});

test("Modal: aria-modal + đóng bằng Escape + nút X", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);
  await win.getByTestId("nav-notebooks").click();

  // Mở modal tạo notebook.
  await win.getByTestId("notebook-new").click();
  const modal = win.getByTestId("notebook-modal");
  await expect(modal).toBeVisible();
  await expect(modal).toHaveAttribute("aria-modal", "true");

  // Escape đóng.
  await win.keyboard.press("Escape");
  await expect(modal).toBeHidden();

  // Mở lại → đóng bằng nút X.
  await win.getByTestId("notebook-new").click();
  await expect(modal).toBeVisible();
  await win.getByTestId("modal-close").click();
  await expect(modal).toBeHidden();
});
