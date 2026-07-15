import { test, expect, type ElectronApplication } from "@playwright/test";
import { launchFresh, dismissOnboarding, UNREACHABLE_OLLAMA } from "./helper";

// 021-studio e2e (tất định, không cần Ollama). Kiểm whitelist + guard rail (nút vô hiệu, không bịa nội
// dung khi chưa sẵn sàng) + data-path studio:list. Luồng sinh nội dung đầy đủ cần Ollama (model chat) →
// phủ bởi unit (studio-repo/prompt/budget) + kiểm thử thủ công (như tiền lệ source-viewer).
let app: ElectronApplication;

test.beforeAll(async () => {
  app = await launchFresh(UNREACHABLE_OLLAMA);
});
test.afterAll(async () => await app?.close());

test("whitelist: window.api có studioGenerate + studioList, không invoke chung", async () => {
  const win = await app.firstWindow();
  const keys = await win.evaluate(() =>
    Object.keys((window as unknown as { api: object }).api),
  );
  expect(keys).toContain("studioGenerate");
  expect(keys).toContain("studioList");
  expect(keys).not.toContain("invoke");
});

test("studio:list notebook mới → rỗng (chưa có kết quả)", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);

  const list = await win.evaluate(async () => {
    const nb = await window.api.notebookCreate({
      name: "Studio empty",
      color: "#1E6B57",
    });
    return window.api.studioList(nb.id);
  });
  expect(Array.isArray(list)).toBe(true);
  expect(list).toHaveLength(0);
});

test("studio:generate khi chưa có nguồn sẵn sàng → lỗi thân thiện, KHÔNG bịa nội dung", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);

  const outcome = await win.evaluate(async () => {
    const nb = await window.api.notebookCreate({
      name: "Studio no-source",
      color: "#1E6B57",
    });
    try {
      const res = await window.api.studioGenerate({
        notebookId: nb.id,
        kind: "summary",
      });
      return { ok: true as const, content: res.content };
    } catch (e) {
      return { ok: false as const, message: (e as Error).message };
    }
  });
  // Không sinh nội dung bịa: phải REJECT (không trả content).
  expect(outcome.ok).toBe(false);
});

test("cột Studio: chưa có nguồn ready / runtime chưa sẵn sàng → nút vô hiệu + gợi ý", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);

  const nbId = await win.evaluate(async () => {
    const nb = await window.api.notebookCreate({
      name: "Studio UI",
      color: "#1E6B57",
    });
    return nb.id;
  });
  await win.evaluate((id) => {
    window.location.hash = `#/workspace/${id}`;
  }, nbId);

  await expect(win.getByTestId("studio-col")).toBeVisible();
  // Ollama unreachable → block hint hiển thị.
  await expect(win.getByTestId("studio-block")).toBeVisible();
  // 4 nút Tạo nhanh đều bị vô hiệu.
  for (const kind of ["summary", "keyPoints", "faq", "outline"]) {
    await expect(win.getByTestId(`studio-btn-${kind}`)).toBeDisabled();
  }
});

test("clipboardWrite: ghi được từ renderer sandbox → main clipboard khớp (#67)", async () => {
  // Bug gốc #67 chỉ lộ trong renderer sandbox thật (permission deny-all): navigator.clipboard bị chặn.
  // Fix đưa qua IPC → Electron clipboard. Verify: gọi từ window rồi đọc lại bằng clipboard của main.
  const win = await app.firstWindow();
  const text = `insightvault-clip-${Date.now()}`;

  const res = await win.evaluate((t) => window.api.clipboardWrite(t), text);
  expect(res).toEqual({ ok: true });

  const readBack = await app.evaluate(({ clipboard }) => clipboard.readText());
  expect(readBack).toBe(text);
});
