import { test, expect } from "@playwright/test";
import {
  dismissOnboarding,
  evaluateMain,
  launchMeeting,
  openNewWorkspace,
  readyWindow,
} from "./helper";

// 186 PR C1 (FR-038, quickstart dòng PR C1): thoát khi đang ghi ⇒ hỏi (hộp thoại ở main — e2e trả lời qua IV_E2E_QUIT_ANSWER).
// Huỷ ⇒ vẫn ghi. Đồng ý ⇒ kết thúc như người dùng bấm, thoát; mở lại ⇒ KHÔNG có thẻ phục hồi, transcript tự chốt.

async function startRecording(
  win: Awaited<ReturnType<typeof readyWindow>>,
): Promise<string> {
  await dismissOnboarding(win);
  const nbId = await openNewWorkspace(win);
  await win.getByTestId("record-meeting-btn").click();
  await win.getByTestId("meeting-begin").click();
  await expect(win.getByTestId("recording-view")).toBeVisible();
  await win.waitForTimeout(6_000);
  return nbId;
}

test("thoát khi đang ghi + Huỷ ⇒ app không thoát, vẫn ghi", async () => {
  test.setTimeout(60_000);
  const { app } = await launchMeeting({
    env: { IV_E2E_QUIT_ANSWER: "cancel" },
  });
  const win = await readyWindow(app);
  await startRecording(win);
  // T122: phím tắt Mod+Shift+P tạm dừng / tiếp tục (Cmd trên macOS, Ctrl nơi khác).
  const mod = process.platform === "darwin" ? "Meta" : "Control";
  await win.keyboard.press(`${mod}+Shift+KeyP`);
  await expect(win.getByTestId("recording-status")).toContainText(
    "Đã tạm dừng",
  );
  await win.keyboard.press(`${mod}+Shift+KeyP`);
  await expect(win.getByTestId("recording-status")).toContainText("Đang ghi");
  await evaluateMain(app, ({ app: a }) => a.quit());
  await win.waitForTimeout(1_500);
  expect((await win.evaluate(() => window.api.meetingStatus()))?.phase).toBe(
    "recording",
  );
  app.process().kill("SIGKILL");
});

test("thoát khi đang ghi + Đồng ý ⇒ kết thúc rồi thoát; mở lại tự chốt, không có thẻ phục hồi", async () => {
  test.setTimeout(120_000);
  const first = await launchMeeting({
    env: { IV_E2E_QUIT_ANSWER: "confirm" },
  });
  const win1 = await readyWindow(first.app);
  const nbId = await startRecording(win1);
  const exited = new Promise<void>((r) =>
    first.app.process().once("exit", () => r()),
  );
  await evaluateMain(first.app, ({ app: a }) => a.quit());
  await exited;

  const second = await launchMeeting({ userData: first.userData });
  const win2 = await readyWindow(second.app);
  await win2.evaluate((nb) => {
    window.location.hash = `#/workspace/${nb}`;
  }, nbId);
  await win2.getByTestId("workspace").waitFor({ state: "visible" });
  await expect(win2.getByTestId("recovery-card")).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (
          await win2.evaluate((nb) => window.api.sourceListByNotebook(nb), nbId)
        ).find((s) => s.kind === "meeting")?.meetingPhase,
      { timeout: 60_000 },
    )
    .toBe("done");
  await second.app.close();
});
