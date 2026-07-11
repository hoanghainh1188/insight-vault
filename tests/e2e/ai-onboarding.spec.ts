import { test, expect, type ElectronApplication } from "@playwright/test";
import { launchFresh, dismissOnboarding, UNREACHABLE_OLLAMA } from "./helper";

// V6/US3: Ollama không sẵn sàng (ép qua OLLAMA_HOST không kết nối) → onboarding runtime thật hiện
// hướng dẫn + "cài sau"; bấm "cài sau" → vào app (không nhốt người dùng).
let app: ElectronApplication;
test.beforeAll(async () => {
  app = await launchFresh(UNREACHABLE_OLLAMA);
});
test.afterAll(async () => {
  await app?.close();
});

test("V6 — runtime onboarding hiện khi Ollama chưa sẵn sàng, 'cài sau' vào app", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win); // đóng màn chào (001) trước

  const banner = win.getByTestId("runtime-onboarding");
  await expect(banner).toBeVisible();
  await expect(win.getByTestId("runtime-reason")).not.toBeEmpty();

  await win.getByTestId("runtime-skip").click();
  await expect(banner).toBeHidden();
  // Vào app ở trạng thái giới hạn: vẫn xem được UI (khu vực Notebooks).
  await expect(win.getByTestId("placeholder-notebooks")).toBeVisible();
});
