import { test, expect, type ElectronApplication } from "@playwright/test";
import { launchFresh, dismissOnboarding, UNREACHABLE_OLLAMA } from "./helper";

// 013-rag-qa e2e. Ollama unreachable (tất định) → cột Chat chặn gửi + hướng dẫn (US4/FR-011).
// Kiểm whitelist rag:* + notebook rỗng chặn. (Luồng ragAsk đầy đủ cần Ollama → để unit/manual.)
let app: ElectronApplication;

test.beforeAll(async () => {
  app = await launchFresh(UNREACHABLE_OLLAMA);
});
test.afterAll(async () => {
  await app?.close();
});

test("whitelist: window.api có ragAsk, không invoke chung", async () => {
  const win = await app.firstWindow();
  const keys = await win.evaluate(() =>
    Object.keys((window as unknown as { api: object }).api),
  );
  expect(keys).toContain("ragAsk");
  expect(keys).not.toContain("invoke");
});

test("cột Chat: runtime chưa sẵn sàng → chặn gửi + hướng dẫn (không gửi request)", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);

  const nbId = await win.evaluate(async () => {
    const nb = await window.api.notebookCreate({
      name: "E2E rag",
      color: "#1E6B57",
    });
    return nb.id;
  });
  await win.evaluate((id) => {
    window.location.hash = `#/workspace/${id}`;
  }, nbId);

  await expect(win.getByTestId("chat-column")).toBeVisible();
  // Ollama unreachable → block; ô gửi không hiển thị (thay bằng chat-block).
  await expect(win.getByTestId("chat-block")).toBeVisible();
  await expect(win.getByTestId("chat-send")).toHaveCount(0);
});
