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

// #135: Ollama bật SAU khi mở app ⇒ app tự kiểm tra lại: banner biến mất + Chat gỡ chặn runtime, không cần bấm gì.
test("#135 — Ollama bật sau khi mở app ⇒ tự nhận, banner và Chat cập nhật", async () => {
  const { createServer } = await import("node:http");
  const port = 39000 + Math.floor(Math.random() * 1000);
  const app2 = await launchFresh({ OLLAMA_HOST: `http://127.0.0.1:${port}` });
  const win = await app2.firstWindow();
  await dismissOnboarding(win);
  await expect(win.getByTestId("runtime-onboarding")).toBeVisible();

  const nbId = await win.evaluate(async () => {
    await window.api.aiSetSelectedModels({
      chatModel: "fake:1b",
      embeddingModel: null,
    });
    const nb = await window.api.notebookCreate({
      name: "Late",
      color: "#1E6B57",
    });
    return nb.id;
  });
  await win.evaluate((id) => {
    window.location.hash = `#/workspace/${id}`;
  }, nbId);
  const block = win.getByTestId("chat-block");
  await expect(block).toBeVisible();
  const blockedText = await block.innerText();

  // "Ollama" giả: chỉ /api/tags (đủ cho kiểm tra sẵn sàng).
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ models: [{ name: "fake:1b", size: 1 }] }));
  });
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  try {
    await expect(win.getByTestId("runtime-onboarding")).toBeHidden({
      timeout: 15_000,
    });
    // Chat hết chặn vì runtime (còn chặn vì chưa có nguồn ⇒ câu khác).
    await expect
      .poll(
        async () =>
          (await block.count()) === 0 ||
          (await block.innerText()) !== blockedText,
        {
          timeout: 15_000,
        },
      )
      .toBe(true);
  } finally {
    await app2.close();
    server.close();
  }
});
