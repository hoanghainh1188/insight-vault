import { test, expect } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { dismissOnboarding, launchMeeting, openNewWorkspace } from "./helper";

// 186 — PR A qua giao diện (quickstart dòng PR A): hộp bắt đầu → ghi → tạm dừng/tiếp tục → điều hướng không dừng ghi →
// kết thúc → màn hoàn tất → nguồn sẵn sàng → mở trích dẫn từ tìm toàn văn chỉ TUA (C1) → xoá nguồn xoá audio. Kèm SC-004
// (≤ 2 thao tác để bắt đầu) và SC-010 (không request mạng ra ngoài, chỉ báo riêng tư luôn "local").

test("ghi cuộc họp qua giao diện, hoàn tất, trích dẫn chỉ tua, xoá được", async () => {
  test.setTimeout(120_000);
  const { app, userData } = await launchMeeting();
  // SC-010: đếm mọi request không phải tài nguyên nội bộ của app.
  await app.evaluate(({ session }) => {
    const g = globalThis as unknown as { __external: string[] };
    g.__external = [];
    session.defaultSession.webRequest.onBeforeRequest((d, cb) => {
      if (!/^(file|iv-media|devtools|data|blob|chrome-extension):/.test(d.url))
        g.__external.push(d.url);
      cb({});
    });
  });
  const win = await app.firstWindow();
  await dismissOnboarding(win);
  const nbId = await openNewWorkspace(win);

  // SC-004: 2 thao tác — mở hộp + Bắt đầu ghi.
  await win.getByTestId("record-meeting-btn").click();
  const dialog = win.getByTestId("meeting-start-dialog");
  await expect(dialog).toBeVisible();
  await expect(win.getByTestId("meeting-title")).toHaveValue(
    /^Cuộc họp \d{2}\/\d{2}, \d{2}:\d{2}$/,
  );
  await expect(win.getByTestId("meeting-privacy")).toContainText(
    "Âm thanh và transcript được xử lý trên máy này.",
  );
  await win.getByTestId("meeting-title").fill("Họp giao diện");
  await win.getByTestId("meeting-begin").click();

  await expect(win.getByTestId("recording-view")).toBeVisible();
  await expect(win.getByTestId("recording-status")).toContainText("Đang ghi");
  await expect(win.getByTestId("recording-status")).toContainText(
    "Lưu trên máy",
  );
  await expect
    .poll(async () => win.getByTestId("recording-clock").innerText(), {
      timeout: 10_000,
    })
    .not.toBe("00:00:00");
  await expect(win.getByTestId("record-meeting-btn")).toBeDisabled();

  // Tạm dừng / tiếp tục.
  await win.getByTestId("recording-pause").click();
  await expect(win.getByTestId("recording-status")).toContainText(
    "Đã tạm dừng — không thu âm",
  );
  await win.getByTestId("recording-resume").click();
  await expect(win.getByTestId("recording-status")).toContainText("Đang ghi");

  // FR-041: rời notebook vẫn ghi; thanh trạng thái toàn cục đưa về lại.
  await win.evaluate(() => {
    window.location.hash = "#/notebooks";
  });
  await expect(win.getByTestId("recording-bar")).toBeVisible();
  const before = await win.getByTestId("recording-bar").innerText();
  await win.waitForTimeout(2500);
  await expect
    .poll(async () => win.getByTestId("recording-bar").innerText())
    .not.toBe(before);
  await win.getByTestId("recording-bar-back").click();
  await expect(win.getByTestId("recording-view")).toBeVisible();

  // Ghi thêm cho đủ ≥ 2 cửa sổ ASR giả (10 s/cửa sổ) rồi kết thúc (< 5 phút ⇒ không hỏi xác nhận).
  await win.waitForTimeout(12_000);
  await win.getByTestId("recording-end").click();
  await expect(win.getByTestId("recording-end-confirm")).toHaveCount(0);
  await expect(win.getByTestId("finalize-view")).toBeVisible();
  await expect(win.getByTestId("finalize-ready")).toBeVisible({
    timeout: 60_000,
  });

  const source = await win.evaluate(async (nb) => {
    const list = await window.api.sourceListByNotebook(nb);
    return list.find((s) => s.kind === "meeting") ?? null;
  }, nbId);
  expect(source).toMatchObject({
    title: "Họp giao diện",
    status: "ready",
    meetingPhase: "done",
  });
  await win.getByTestId("finalize-back").click();

  // C1: mở kết quả tìm toàn văn (có tStart) ⇒ player tua tới mốc, KHÔNG tự phát.
  await win.getByTestId("content-search-input").fill("đoạn");
  await win.getByTestId("content-search-hit").first().click();
  const audio = win
    .locator('[data-testid="viewer-audio-player"] audio, audio')
    .first();
  await expect(audio).toBeVisible();
  await expect
    .poll(
      async () =>
        audio.evaluate(
          (a: HTMLAudioElement) => a.readyState >= 1 && a.currentTime >= 0,
        ),
      { timeout: 10_000 },
    )
    .toBe(true);
  expect(await audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);

  // SC-010.
  const external = await app.evaluate(
    () => (globalThis as unknown as { __external: string[] }).__external,
  );
  expect(external).toEqual([]);
  expect((await win.evaluate(() => window.api.getPrivacyState())).mode).toBe(
    "local",
  );

  // FR-015: xoá nguồn ⇒ thư mục audio do app sở hữu biến mất.
  const dirs = join(userData, "meetings");
  expect(existsSync(dirs)).toBe(true);
  await win
    .getByTestId(`source-${source!.id}`)
    .getByTestId("source-delete")
    .click();
  await expect(win.getByTestId(`source-${source!.id}`)).toHaveCount(0);
  await expect.poll(() => readdirSync(dirs).length).toBe(0);
  await app.close();
});

test("quyền micro bị từ chối ⇒ hướng dẫn, không tạo nguồn", async () => {
  const { app } = await launchMeeting({ denied: true });
  const win = await app.firstWindow();
  await dismissOnboarding(win);
  const nbId = await openNewWorkspace(win);
  await win.getByTestId("record-meeting-btn").click();
  await expect(win.getByTestId("meeting-denied")).toBeVisible();
  await expect(win.getByTestId("meeting-begin")).toBeDisabled();
  expect(
    await win.evaluate((nb) => window.api.sourceListByNotebook(nb), nbId),
  ).toEqual([]);
  await app.close();
});
