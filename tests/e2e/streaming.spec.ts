import { test, expect, type ElectronApplication } from "@playwright/test";
import { launchFresh, dismissOnboarding } from "./helper";

// 039-streaming: kênh streaming whitelisted + expose ở preload. Stream token thật cần model → phủ unit
// (stream-parse, rag-service.askStream) + thủ công; e2e kiểm bề mặt IPC tất định.
let app: ElectronApplication;
test.beforeAll(async () => {
  app = await launchFresh();
});
test.afterAll(async () => {
  await app?.close();
});

test("preload expose ragAskStream/ragStop/onRagStreamToken; không invoke chung", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);
  const shape = await win.evaluate(() => ({
    askStream: typeof window.api.ragAskStream,
    stop: typeof window.api.ragStop,
    onToken: typeof window.api.onRagStreamToken,
    invoke: "invoke" in window.api,
  }));
  expect(shape.askStream).toBe("function");
  expect(shape.stop).toBe("function");
  expect(shape.onToken).toBe("function");
  expect(shape.invoke).toBe(false);
});
