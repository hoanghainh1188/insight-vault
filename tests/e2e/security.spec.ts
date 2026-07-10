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

test("V5 — window.api chỉ có 5 hàm whitelisted, không có invoke chung", async () => {
  const win = await app.firstWindow();
  const apiKeys = await win.evaluate(() =>
    Object.keys((window as unknown as { api: object }).api),
  );
  expect(apiKeys.sort()).toEqual(
    [
      "getAppInfo",
      "getDataDir",
      "getOnboardingState",
      "getPrivacyState",
      "setOnboardingComplete",
    ].sort(),
  );
  expect(apiKeys).not.toContain("invoke");
});
