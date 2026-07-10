import { test, expect, type ElectronApplication } from "@playwright/test";
import { launchFresh, dismissOnboarding } from "./helper";

// V8 (Constitution I): 0 request mạng ra ngoài khi dùng shell (font self-host, CSP default-src 'self').
let app: ElectronApplication;
const external: string[] = [];

test.beforeAll(async () => {
  app = await launchFresh();
  const win = await app.firstWindow();
  win.on("request", (req) => {
    const url = req.url();
    // Chỉ tính request ra host ngoài (http/https tới domain thật), bỏ qua file:/data:/devtools.
    if (/^https?:\/\//i.test(url) && !url.startsWith("http://localhost"))
      external.push(url);
  });
  await dismissOnboarding(win);
  await win.getByTestId("nav-workspace").click();
  await win.getByTestId("nav-settings").click();
});
test.afterAll(async () => {
  await app?.close();
});

test("V8 — không có request mạng ra ngoài", () => {
  expect(external).toEqual([]);
});
