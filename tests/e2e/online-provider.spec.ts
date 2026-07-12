import { test, expect, type ElectronApplication } from "@playwright/test";
import { launchFresh, dismissOnboarding } from "./helper";

// 031-online-provider: section "AI online" ở Cài đặt hiển thị 3 provider; mặc định chưa có key → toggle
// khoá; badge vẫn 'local'. (Luồng bật→badge online phụ thuộc keychain OS nên phủ ở unit online-runtime;
// e2e chỉ kiểm phần tất định, không phụ thuộc backend keytar.)
let app: ElectronApplication;
test.beforeAll(async () => {
  app = await launchFresh();
});
test.afterAll(async () => {
  await app?.close();
});

test("AI online — 3 provider hiển thị, toggle khoá khi chưa có key, badge vẫn local", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);

  await win.getByTestId("nav-settings").click();
  await expect(win.getByTestId("settings-ai-online")).toBeVisible();

  // 3 hàng provider + ghi chú egress
  for (const id of ["anthropic", "gemini", "openai"]) {
    await expect(win.getByTestId(`online-row-${id}`)).toBeVisible();
  }
  await expect(win.getByTestId("online-egress-note")).toBeVisible();

  // Chưa nhập key → trạng thái + toggle bị vô hiệu hoá
  await expect(win.getByTestId("online-key-status-openai")).toContainText(
    "Chưa nhập khóa API",
  );
  await expect(win.getByTestId("online-toggle-openai")).toBeDisabled();

  // Badge riêng tư mặc định vẫn local (chưa bật provider nào)
  await expect(win.getByTestId("privacy-badge")).not.toHaveClass(/online/);
});

test("6 kênh online whitelisted + không có tag active khi chưa bật", async () => {
  const win = await app.firstWindow();
  // getOnlineState gọi được qua preload (kênh whitelisted) → trả 3 provider, activeOnlineId null
  const state = await win.evaluate(() => window.api.aiGetOnlineState());
  expect(state.providers).toHaveLength(3);
  expect(state.activeOnlineId).toBeNull();
});
