import { test, expect } from "@playwright/test";
import {
  dismissOnboarding,
  launchMeeting,
  openNewWorkspace,
  readyWindow,
} from "./helper";

// 186 PR C1 (quickstart dòng PR C1, US5): đang ghi thì app bị giết (SIGKILL) ⇒ mở lại thấy thẻ phục hồi + huy hiệu ở trang
// Notebooks; "Giữ như nguồn chưa hoàn thiện" ⇒ nguồn nghe được; mở nguồn ⇒ "Hoàn tất transcript" ⇒ có transcript chốt.

test("app bị giết khi đang ghi ⇒ thẻ phục hồi; giữ chưa hoàn thiện rồi hoàn tất transcript", async () => {
  test.setTimeout(150_000);
  const first = await launchMeeting();
  const win1 = await readyWindow(first.app);
  await dismissOnboarding(win1);
  const nbId = await openNewWorkspace(win1);
  await win1.getByTestId("record-meeting-btn").click();
  await win1.getByTestId("meeting-title").fill("Họp bị ngắt");
  await win1.getByTestId("meeting-begin").click();
  await expect(win1.getByTestId("recording-view")).toBeVisible();
  await win1.waitForTimeout(12_000); // > 1 lần fsync (5 s) ⇒ audio có trên đĩa
  first.app.process().kill("SIGKILL");
  await new Promise<void>((r) => first.app.process().once("exit", () => r()));

  const second = await launchMeeting({ userData: first.userData });
  const win2 = await readyWindow(second.app);
  await win2.getByTestId("app-name").waitFor();
  await win2.evaluate(() => {
    window.location.hash = "#/notebooks";
  });
  await expect(win2.getByTestId("notebook-recover-badge")).toContainText(
    "1 bản ghi cần phục hồi",
  );
  await win2.evaluate((nb) => {
    window.location.hash = `#/workspace/${nb}`;
  }, nbId);
  const card = win2.getByTestId("recovery-card");
  await expect(card).toContainText("Họp bị ngắt");
  await card.getByTestId("recovery-keep").click();
  await expect(win2.getByTestId("recovery-card")).toHaveCount(0);
  await expect(win2.getByTestId("notebook-recover-badge")).toHaveCount(0);

  const src = await win2.evaluate(async (nb) => {
    const list = await window.api.sourceListByNotebook(nb);
    return list.find((s) => s.kind === "meeting") ?? null;
  }, nbId);
  expect(src).toMatchObject({ meetingPhase: "incomplete", status: "ready" });

  // Mở nguồn ⇒ "Hoàn tất transcript" (ASR giả) ⇒ transcript chốt.
  await win2.getByTestId(`source-${src!.id}`).click();
  await win2.getByTestId("meeting-finalize-again").click();
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
