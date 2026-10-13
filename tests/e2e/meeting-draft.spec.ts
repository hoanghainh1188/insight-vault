import { test, expect } from "@playwright/test";
import {
  dismissOnboarding,
  launchMeeting,
  openNewWorkspace,
  readyWindow,
} from "./helper";

// 186 PR B (quickstart dòng PR B): khi đang ghi, transcript nháp hiện dần có timestamp; ngôn ngữ Tự động nhận dạng ra
// "Tiếng Việt · Tự động" (SC-008, ASR giả trả `vi`); chỉ báo âm lượng; 3 đánh dấu còn sau khi hoàn tất; bấm timestamp ⇒
// nghe lại đoạn đó từ phân đoạn đang ghi. Tín hiệu thử: 440 Hz bật/tắt mỗi 10 s (mic-capture fakeTone).

test("nháp gần thời gian thực: timestamp, ngôn ngữ tự động, mức âm, đánh dấu, nghe lại", async () => {
  test.setTimeout(180_000);
  const { app } = await launchMeeting();
  const win = await readyWindow(app);
  await dismissOnboarding(win);
  const nbId = await openNewWorkspace(win);

  await win.getByTestId("record-meeting-btn").click();
  await win.getByTestId("meeting-language").selectOption("auto");
  await win.getByTestId("meeting-title").fill("Họp nháp");
  await win.getByTestId("meeting-begin").click();
  await expect(win.getByTestId("recording-view")).toBeVisible();
  await expect(win.getByTestId("recording-language-status")).toHaveText(
    "Đang nhận dạng ngôn ngữ…",
  );

  // Dòng nháp đầu tiên: có timestamp, nội dung từ ASR giả.
  const first = win.getByTestId("draft-line").first();
  await expect(first).toBeVisible({ timeout: 30_000 });
  await expect(first).toContainText("00:00:00");
  await expect(first).toContainText("đoạn");

  // Chỉ báo âm lượng có nhãn chữ (không chỉ màu).
  await expect(win.getByTestId("recording-level")).toHaveAttribute(
    "aria-label",
    /Mức âm thanh micro: Âm thanh (yếu|tốt|quá to)/,
  );

  // SC-008: nhận dạng ngôn ngữ sau đủ 30 s lời nói (tín hiệu thử bật/tắt ⇒ cần ~ 60 s thời gian thực).
  await expect(win.getByTestId("recording-language-status")).toHaveText(
    "Tiếng Việt · Tự động",
    { timeout: 90_000 },
  );

  // Ba đánh dấu.
  for (const kind of ["decision", "actionItem", "question"]) {
    await win.getByTestId("recording-mark").click();
    await win.getByTestId(`recording-mark-${kind}`).click();
  }
  await expect(win.getByTestId("recording-markers").locator("li")).toHaveCount(
    3,
  );

  // Khoá tay ngôn ngữ qua menu (chỉ khi chọn mục — không như <select>).
  await win.getByTestId("recording-language-change").click();
  await win.getByTestId("recording-language-lock-en").click();
  await expect(win.getByTestId("recording-language-status")).toHaveText(
    "English",
  );

  // Bấm timestamp ⇒ phát lại từ phân đoạn đang ghi (header WAV dựng theo kích thước hiện tại).
  await first.getByRole("button").click();
  const audio = win.locator(".draft-wrap audio");
  await expect
    .poll(
      () =>
        audio.evaluate((a: HTMLAudioElement) => a.readyState >= 1 && !a.error),
      { timeout: 10_000 },
    )
    .toBe(true);
  await first.getByRole("button").click(); // dừng nghe lại

  await win.getByTestId("recording-end").click();
  await expect(win.getByTestId("finalize-ready")).toBeVisible({
    timeout: 90_000,
  });
  const markers = await win.evaluate(async (nb) => {
    const src = (await window.api.sourceListByNotebook(nb)).find(
      (s) => s.kind === "meeting",
    );
    return src ? window.api.meetingListMarkers({ sourceId: src.id }) : [];
  }, nbId);
  expect(markers.map((m) => m.kind)).toEqual([
    "decision",
    "actionItem",
    "question",
  ]);
  await app.close();
});
