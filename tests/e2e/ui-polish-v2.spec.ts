import { test, expect, type ElectronApplication } from "@playwright/test";
import { launchFresh, dismissOnboarding } from "./helper";

// 037-ui-polish-v2: section "Lưu trữ cục bộ" ở Cài đặt (đường dẫn + dung lượng). Tiến độ nguồn realtime +
// nhãn [n] cần ingest/viewer thật → phủ unit + thủ công; e2e kiểm phần tất định.
let app: ElectronApplication;
test.beforeAll(async () => {
  app = await launchFresh();
});
test.afterAll(async () => {
  await app?.close();
});

test("Cài đặt có section Lưu trữ với đường dẫn + dung lượng", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);
  await win.getByTestId("nav-settings").click();
  await expect(win.getByTestId("settings-storage")).toBeVisible();
  // Sau khi tính xong → hiện đường dẫn + dung lượng (data dir mới nên nhỏ, tính nhanh).
  await expect(win.getByTestId("storage-path")).toBeVisible({ timeout: 10000 });
  await expect(win.getByTestId("storage-meta")).toContainText("Đã dùng");
});

test("getStorageInfo whitelisted, trả path + số byte", async () => {
  const win = await app.firstWindow();
  const info = await win.evaluate(() => window.api.getStorageInfo());
  expect(typeof info.path).toBe("string");
  expect(info.path.length).toBeGreaterThan(0);
  expect(typeof info.usedBytes).toBe("number");
  expect(typeof info.freeBytes).toBe("number");
});
