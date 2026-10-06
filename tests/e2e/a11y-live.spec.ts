import { test, expect, type ElectronApplication } from "@playwright/test";
import { join } from "node:path";
import { launchFresh, dismissOnboarding, UNREACHABLE_OLLAMA } from "./helper";

// 091 — vùng aria-live dùng chung: có sẵn trong vỏ app (ẩn khỏi màn hình) và báo mốc khi nguồn nạp xong.
// Cần `npm run build` trước.
let app: ElectronApplication;
const FIXTURE = join(process.cwd(), "tests/fixtures/sample.txt");

test.beforeAll(async () => {
  app = await launchFresh(UNREACHABLE_OLLAMA);
});
test.afterAll(async () => {
  await app?.close();
});

test("vùng thông báo polite/assertive có mặt và ẩn khỏi màn hình", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);
  const polite = win.getByTestId("live-polite");
  await expect(polite).toHaveAttribute("aria-live", "polite");
  await expect(win.getByTestId("live-assertive")).toHaveAttribute(
    "aria-live",
    "assertive",
  );
  const box = await polite.boundingBox();
  expect(box?.width ?? 0).toBeLessThanOrEqual(1);
});

test("nạp nguồn ở Workspace ⇒ báo 'đã sẵn sàng' kèm tên nguồn", async () => {
  const win = await app.firstWindow();
  const nbId = await win.evaluate(async () => {
    const nb = await window.api.notebookCreate({
      name: "E2E a11y",
      color: "#1E6B57",
    });
    return nb.id;
  });
  await win.evaluate((id) => (location.hash = `#/workspace/${id}`), nbId);
  await expect(win.getByTestId("chat-column")).toBeVisible();

  await win.evaluate(
    async ([id, path]) =>
      window.api.sourceAdd({ notebookId: id, kind: "txt", filePath: path }),
    [nbId, FIXTURE] as const,
  );
  await expect(win.getByTestId("live-polite")).toHaveText(
    /Nguồn “sample\.txt” đã sẵn sàng\./,
    { timeout: 15000 },
  );
});
