import { test, expect, type ElectronApplication } from "@playwright/test";
import { launchFresh, dismissOnboarding, UNREACHABLE_OLLAMA } from "./helper";

// 027-chat-history e2e (tất định, không cần Ollama). Phủ whitelist + data-path chat:history/chat:clear.
// Persist qua hỏi đáp thật cần Ollama → unit chat-repo + thủ công.
let app: ElectronApplication;

test.beforeAll(async () => {
  app = await launchFresh(UNREACHABLE_OLLAMA);
});
test.afterAll(async () => await app?.close());

test("whitelist: window.api có chatHistory + chatClear, không invoke chung", async () => {
  const win = await app.firstWindow();
  const keys = await win.evaluate(() =>
    Object.keys((window as unknown as { api: object }).api),
  );
  expect(keys).toContain("chatHistory");
  expect(keys).toContain("chatClear");
  expect(keys).not.toContain("invoke");
});

test("chat:history notebook mới → rỗng; chat:clear → {cleared:true}", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);

  const result = await win.evaluate(async () => {
    const nb = await window.api.notebookCreate({
      name: "Chat H",
      color: "#1E6B57",
    });
    const before = await window.api.chatHistory(nb.id);
    const cleared = await window.api.chatClear(nb.id);
    const after = await window.api.chatHistory(nb.id);
    return { before, cleared, after };
  });
  expect(result.before).toEqual([]);
  expect(result.cleared).toEqual({ cleared: true });
  expect(result.after).toEqual([]);
});
