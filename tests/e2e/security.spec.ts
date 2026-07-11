import { test, expect, type ElectronApplication } from "@playwright/test";
import { launchFresh } from "./helper";

// V4/V5 (US2): renderer không chạm Node/FS; chỉ 5 kênh whitelisted, không API gọi kênh tuỳ ý.
let app: ElectronApplication;
test.beforeAll(async () => {
  app = await launchFresh();
});
test.afterAll(async () => {
  await app?.close();
});

test("V4 — renderer không truy cập Node/FS trực tiếp", async () => {
  const win = await app.firstWindow();
  const hasNode = await win.evaluate(() => {
    // @ts-expect-error kiểm tra runtime
    return (
      typeof window.require !== "undefined" || typeof process !== "undefined"
    );
  });
  expect(hasNode).toBe(false);
});

test("V5 — window.api chỉ gồm hàm whitelisted (app-shell), không có invoke chung", async () => {
  const win = await app.firstWindow();
  const apiKeys = await win.evaluate(() =>
    Object.keys((window as unknown as { api: object }).api),
  );
  // 5 hàm app-shell phải có mặt (feature sau thêm hàm khác — kiểm tập chính xác ở ai-security.spec).
  for (const fn of [
    "getAppInfo",
    "getDataDir",
    "getOnboardingState",
    "getPrivacyState",
    "setOnboardingComplete",
  ]) {
    expect(apiKeys).toContain(fn);
  }
  // KHÔNG có API gọi kênh tuỳ ý.
  expect(apiKeys).not.toContain("invoke");
  expect(
    apiKeys.every((k) => /^(get|set|ai)/.test(k) || k.startsWith("ai")),
  ).toBe(true);
});
