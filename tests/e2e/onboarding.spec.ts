import { test, expect } from "@playwright/test";
import { launchFresh } from "./helper";

// V6 (US4): lần đầu hiện onboarding; hoàn tất → mở lại không hiện. userData tạm để cô lập.
test("V6 — onboarding hiện lần đầu, ẩn sau khi hoàn tất", async () => {
  const app = await launchFresh();
  const win = await app.firstWindow();
  await expect(win.getByTestId("onboarding")).toBeVisible();
  await win.getByTestId("onboarding-start").click();
  await expect(win.getByTestId("onboarding")).toBeHidden();
  await app.close();
});
