import { test, expect, type ElectronApplication } from "@playwright/test";
import { launchFresh, dismissOnboarding } from "./helper";

// 059-embed-in-process: Cài đặt → AI hiển thị gợi ý model theo RAM + trạng thái Ollama + ghi chú embedding
// chạy in-process. Phần tất định (không phụ thuộc Ollama thật) — chi tiết embedding/reindex phủ ở unit.
let app: ElectronApplication;
test.beforeAll(async () => {
  app = await launchFresh();
});
test.afterAll(async () => {
  await app?.close();
});

test("Cài đặt AI — gợi ý model theo RAM + ghi chú embedding in-process", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);

  await win.getByTestId("nav-settings").click();
  await expect(win.getByTestId("settings-ai")).toBeVisible();

  // 059: gợi ý cỡ model theo RAM máy (luôn tính được từ os.totalmem()).
  await expect(win.getByTestId("ram-advice")).toBeVisible();
  await expect(win.getByTestId("ram-advice")).toContainText("RAM");

  // 059: ghi chú embedding chạy in-process (không cần Ollama cho khâu nhúng).
  await expect(win.getByTestId("ai-embed-inprocess")).toBeVisible();
  await expect(win.getByTestId("ai-embed-inprocess")).toContainText(
    "không cần Ollama",
  );

  // Badge riêng tư vẫn local (embedding local, không egress thường ngày).
  await expect(win.getByTestId("privacy-badge")).not.toHaveClass(/online/);
});
