import { test, expect, type ElectronApplication } from "@playwright/test";
import { launchFresh, dismissOnboarding } from "./helper";

// 043-keyboard-shortcuts: "?" mở bảng trợ giúp (Esc đóng); Cmd/Ctrl+N mở modal tạo notebook; Cmd/Ctrl+K
// focus ô tìm kiếm.
let app: ElectronApplication;
test.beforeAll(async () => {
  app = await launchFresh();
});
test.afterAll(async () => {
  await app?.close();
});

test('"?" mở bảng phím tắt, Esc đóng', async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);
  await win.keyboard.press("?");
  await expect(win.getByTestId("shortcuts-help")).toBeVisible();
  await expect(win.getByTestId("shortcuts-help")).toContainText("Phím tắt");
  await win.keyboard.press("Escape");
  await expect(win.getByTestId("shortcuts-help")).toBeHidden();
});

test("Ctrl+N mở modal tạo notebook; Ctrl+K focus ô tìm", async () => {
  const win = await app.firstWindow();
  await win.keyboard.press("Control+n");
  await expect(win.getByTestId("notebook-modal")).toBeVisible();
  await win.keyboard.press("Escape");
  await expect(win.getByTestId("notebook-modal")).toBeHidden();
  await win.keyboard.press("Control+k");
  await expect(win.getByTestId("notebook-search")).toBeFocused();
});
