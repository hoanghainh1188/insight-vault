import { test, expect, type ElectronApplication } from "@playwright/test";
import { launchFresh } from "./helper";

// US4/SC-006: window.api có 5 hàm notebook (tổng 15); renderer không chạm SQLite trực tiếp.
let app: ElectronApplication;
test.beforeAll(async () => {
  app = await launchFresh();
});
test.afterAll(async () => {
  await app?.close();
});

test("window.api có 5 hàm notebook + tổng 15 hàm whitelisted, không invoke chung", async () => {
  const win = await app.firstWindow();
  const keys = await win.evaluate(() =>
    Object.keys((window as unknown as { api: object }).api),
  );
  for (const fn of [
    "notebookList",
    "notebookCreate",
    "notebookRename",
    "notebookSetColor",
    "notebookDelete",
  ]) {
    expect(keys).toContain(fn);
  }
  expect(keys.length).toBeGreaterThanOrEqual(15); // 5 app + 5 ai + 5 notebook
  expect(keys).not.toContain("invoke");
});

test("renderer không truy cập SQLite/node:sqlite/require trực tiếp", async () => {
  const win = await app.firstWindow();
  const leaked = await win.evaluate(() => {
    // @ts-expect-error kiểm tra runtime
    return (
      typeof window.require !== "undefined" ||
      typeof process !== "undefined" ||
      "DatabaseSync" in window
    );
  });
  expect(leaked).toBe(false);
});
