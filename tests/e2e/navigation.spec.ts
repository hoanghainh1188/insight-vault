import { test, expect, type ElectronApplication } from "@playwright/test";
import { launchFresh, dismissOnboarding } from "./helper";

// V3 (US3): rail chuyển khu vực + active; route hash đổi. Mặc định /notebooks (A6).
let app: ElectronApplication;
test.beforeAll(async () => {
  app = await launchFresh();
});
test.afterAll(async () => {
  await app?.close();
});

test("V3 — điều hướng rail chuyển route + active", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);
  await expect(win.getByTestId("placeholder-notebooks")).toBeVisible();

  await win.getByTestId("nav-workspace").click();
  await expect(win.getByTestId("placeholder-workspace")).toBeVisible();
  expect(await win.evaluate(() => location.hash)).toContain("/workspace");

  await win.getByTestId("nav-settings").click();
  await expect(win.getByTestId("placeholder-settings")).toBeVisible();
  expect(await win.evaluate(() => location.hash)).toContain("/settings");
});
