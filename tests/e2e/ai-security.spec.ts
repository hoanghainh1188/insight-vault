import { test, expect, type ElectronApplication } from "@playwright/test";
import { launchFresh, UNREACHABLE_OLLAMA } from "./helper";

// US4/SC-005: window.api chỉ có hàm whitelisted (5 app + 5 ai), không có invoke chung; renderer không
// gọi Ollama trực tiếp; privacy badge vẫn "local" (Ollama local không egress).
let app: ElectronApplication;
test.beforeAll(async () => {
  app = await launchFresh(UNREACHABLE_OLLAMA);
});
test.afterAll(async () => {
  await app?.close();
});

test("V7 — window.api có đúng 10 hàm whitelisted, không invoke/ipcRenderer", async () => {
  const win = await app.firstWindow();
  const keys = await win.evaluate(() =>
    Object.keys((window as unknown as { api: object }).api).sort(),
  );
  expect(keys).toEqual(
    [
      "aiGetRuntimeStatus",
      "aiGetSelectedModels",
      "aiListModels",
      "aiSetSelectedModels",
      "aiTestConnection",
      "getAppInfo",
      "getDataDir",
      "getOnboardingState",
      "getPrivacyState",
      "setOnboardingComplete",
    ].sort(),
  );
  expect(keys).not.toContain("invoke");
});

test("V7b — renderer không truy cập ipcRenderer/require/process (không thể gọi Ollama trực tiếp)", async () => {
  const win = await app.firstWindow();
  const leaked = await win.evaluate(() => {
    // @ts-expect-error kiểm tra runtime
    return (
      typeof window.require !== "undefined" ||
      typeof process !== "undefined" ||
      "ipcRenderer" in window
    );
  });
  expect(leaked).toBe(false);
});

test("V8 — privacy badge vẫn 'Chạy cục bộ' (Ollama local không egress)", async () => {
  const win = await app.firstWindow();
  await expect(win.getByTestId("privacy-badge")).toContainText("cục bộ");
  await expect(win.getByTestId("privacy-badge")).not.toHaveClass(/online/);
});
