import { test, expect, type ElectronApplication } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { dismissOnboarding, launchFresh } from "./helper";

// 088 — nhật ký ra file trên app thật: bản chưa đóng gói ghi vào <userData>/logs/main.log (JSON lines), có dòng
// app.start; lỗi renderer báo qua kênh whitelisted chỉ lưu loại lỗi + tên component (không message/URL);
// Cài đặt → Lưu trữ có dòng "Nhật ký lỗi". Cần `npm run build` trước.

let app: ElectronApplication;
let logFile: string;

async function readLog(): Promise<Record<string, unknown>[]> {
  const raw = await readFile(logFile, "utf8").catch(() => "");
  return raw
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
}

test.beforeAll(async () => {
  app = await launchFresh();
  const userData = await app.evaluate(({ app: a }) => a.getPath("userData"));
  logFile = join(userData, "logs", "main.log");
});
test.afterAll(async () => {
  await app?.close();
});

test("ghi app.start vào <userData>/logs/main.log", async () => {
  await app.firstWindow();
  await expect
    .poll(async () => (await readLog()).map((r) => r.event))
    .toContain("app.start");
  const start = (await readLog()).find((r) => r.event === "app.start")!;
  expect(start.level).toBe("info");
  expect(start.meta).toMatchObject({ packaged: false });
});

test("lỗi renderer chỉ lưu loại lỗi + tên component", async () => {
  const win = await app.firstWindow();
  const res = await win.evaluate(() =>
    window.api.reportRendererError({
      source: "boundary",
      errorType: "TypeError",
      componentStack:
        "\n    at Workspace (file:///Users/ai-do/app/index.js:1:2)\n    at div",
    }),
  );
  expect(res).toEqual({ ok: true });
  await expect
    .poll(async () => (await readLog()).map((r) => r.event))
    .toContain("renderer.error");
  const rec = (await readLog()).find((r) => r.event === "renderer.error")!;
  expect(rec.level).toBe("error");
  expect(rec.meta).toEqual({
    source: "boundary",
    errorType: "TypeError",
    components: ["Workspace"],
  });
  expect(JSON.stringify(rec)).not.toContain("ai-do");
});

test("Cài đặt → Lưu trữ có dòng Nhật ký lỗi", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);
  await win.getByTestId("nav-settings").click();
  const row = win.getByTestId("logs-row");
  await expect(row).toContainText("Nhật ký lỗi");
  await expect(win.getByTestId("logs-open")).toBeEnabled();
});
