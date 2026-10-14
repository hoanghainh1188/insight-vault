import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  dismissOnboarding,
  evaluateMain,
  launchMeeting,
  openNewWorkspace,
  readyWindow,
} from "./helper";

// 186 PR C2 (quickstart dòng PR C2, US7): mở nguồn cuộc họp đã sẵn sàng ⇒ trình xem theo câu; bấm câu ⇒ tua; câu đang phát
// aria-current; tìm (đếm + sau); đánh dấu trong danh sách (tua); xuất Markdown dựng ở main (hộp thoại lưu được giả lập ở main).

test("trình xem cuộc họp: câu, tua, tìm, đánh dấu, xuất Markdown", async () => {
  test.setTimeout(150_000);
  const { app, userData } = await launchMeeting();
  const win = await readyWindow(app);
  await dismissOnboarding(win);
  const nbId = await openNewWorkspace(win);

  await win.getByTestId("record-meeting-btn").click();
  await win.getByTestId("meeting-title").fill("Họp xem lại");
  await win.getByTestId("meeting-begin").click();
  await expect(win.getByTestId("recording-view")).toBeVisible();
  await win.waitForTimeout(8_000);
  await win.getByTestId("recording-mark").click();
  await win.getByTestId("recording-mark-decision").click();
  await win.waitForTimeout(16_000); // ≥ 2 cửa sổ ASR giả (10 s)
  await win.getByTestId("recording-end").click();
  await expect(win.getByTestId("finalize-ready")).toBeVisible({
    timeout: 60_000,
  });
  await win.getByTestId("finalize-back").click();

  const src = await win.evaluate(async (nb) => {
    const list = await window.api.sourceListByNotebook(nb);
    return list.find((s) => s.kind === "meeting") ?? null;
  }, nbId);
  await win.getByTestId(`source-${src!.id}`).click();
  const viewer = win.getByTestId("meeting-viewer");
  await expect(viewer).toBeVisible();
  const spans = win.getByTestId("meeting-span");
  await expect(spans.first()).toContainText("đoạn");
  const n = await spans.count();
  expect(n).toBeGreaterThanOrEqual(2);

  // Bấm câu cuối ⇒ player tua tới mốc của câu, câu đó thành câu đang phát.
  await spans
    .nth(n - 1)
    .locator("button")
    .click();
  const audio = win.locator('[data-testid="viewer-audio-player"] audio');
  await expect
    .poll(() => audio.evaluate((a: HTMLAudioElement) => a.currentTime))
    .toBeGreaterThan(0);
  await expect(spans.nth(n - 1)).toHaveAttribute("aria-current", "true");
  // Phát sau khi tua: luồng Range giữa tệp phải đọc được (không lỗi media).
  await audio.evaluate((a: HTMLAudioElement) =>
    a.play().catch(() => undefined),
  );
  await expect
    .poll(() => audio.evaluate((a: HTMLAudioElement) => a.currentTime), {
      timeout: 10_000,
    })
    .toBeGreaterThan(20.3);
  expect(
    await audio.evaluate((a: HTMLAudioElement) => a.error?.code ?? null),
  ).toBeNull();
  await expect(win.getByTestId("viewer-audio-error")).toHaveCount(0);
  await audio.evaluate((a: HTMLAudioElement) => a.pause());

  // Tìm (bỏ dấu): "doan" khớp mọi câu "đoạn N".
  await win.getByTestId("meeting-search").fill("doan");
  await expect(win.getByTestId("meeting-search-count")).toHaveText(`1/${n}`);
  await win.getByTestId("meeting-search").press("Enter");
  await expect(win.getByTestId("meeting-search-count")).toHaveText(`2/${n}`);

  // Đánh dấu tạo lúc ghi có trong danh sách; bấm ⇒ tua.
  await expect(win.getByTestId("meeting-marker")).toContainText("Quyết định");

  // Xuất Markdown: giả lập hộp thoại lưu ở main, kiểm nội dung tệp.
  const out = join(userData, "export.md");
  await evaluateMain(
    app,
    ({ dialog }, path) => {
      dialog.showSaveDialog = (async () => ({
        canceled: false,
        filePath: path,
      })) as unknown as typeof dialog.showSaveDialog;
    },
    out,
  );
  await win.getByTestId("meeting-export").click();
  await expect
    .poll(() => readFileSync(out, "utf8").length, {
      timeout: 10_000,
    })
    .toBeGreaterThan(0);
  const md = readFileSync(out, "utf8");
  expect(md).toContain("# Họp xem lại");
  expect(md).toContain("**Quyết định**");
  expect(md).toMatch(/\[00:00:\d\d\] đoạn/);
  await app.close();
});
