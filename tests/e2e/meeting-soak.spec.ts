import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { readdirSync, statSync } from "node:fs";
import { dismissOnboarding, launchMeeting, readyWindow } from "./helper";

// 186 PR C1 (T127): độ bền ghi dài bằng PCM bơm tăng tốc ở main (IV_E2E_AUDIO_PUMP, chỉ bản chưa đóng gói), ASR giả.
// (b) phân đoạn 5 s × 120 ⇒ xoay tệp đúng, thời lượng khớp, hoàn tất thành công — chạy mọi lần.
// (a) 180 phút với phân đoạn mặc định 300 s ⇒ 36 phân đoạn (SC-001) — ghi ~345 MB, chỉ chạy khi IV_E2E_SOAK=1.
// (c)/(d) — worker ASR chết không mất mẫu / app bị giết ⇒ phục hồi: phủ ở unit (writer độc lập ASR) + meeting-recovery.spec.

const FIXTURE = join(process.cwd(), "tests/fixtures/meeting/speech-16k.wav");

async function soak(opts: {
  audioSec: number;
  speed: number;
  segmentSec?: number;
  expectSegments: number;
  timeoutMs: number;
}): Promise<void> {
  const { app, userData } = await launchMeeting({
    env: {
      IV_E2E_AUDIO_PUMP: String(opts.speed),
      IV_E2E_AUDIO_FIXTURE: FIXTURE,
      ...(opts.segmentSec
        ? { IV_MEETING_SEGMENT_SEC: String(opts.segmentSec) }
        : {}),
    },
  });
  const win = await readyWindow(app);
  await dismissOnboarding(win);
  const st = await win.evaluate(async () => {
    const nb = await window.api.notebookCreate({
      name: "Soak",
      color: "#1E6B57",
    });
    await window.api.meetingPrepare({ notebookId: nb.id });
    const r = await window.api.meetingStart({
      notebookId: nb.id,
      title: "Soak",
      languageMode: "vi",
    });
    return { ...r, nb: nb.id };
  });
  await expect
    .poll(
      async () =>
        (await win.evaluate(() => window.api.meetingStatus()))?.durationSec ??
        0,
      { timeout: opts.timeoutMs, intervals: [1000] },
    )
    .toBeGreaterThanOrEqual(opts.audioSec);
  const before = await win.evaluate(() => window.api.meetingStatus());
  // Phân đoạn trên đĩa khớp trạng thái (trước khi ghép).
  const dir = join(userData, "meetings", st.sessionId);
  const segs = readdirSync(dir).filter((f) => /^seg-\d{4}\.wav$/.test(f));
  expect(segs.length).toBeGreaterThanOrEqual(opts.expectSegments);
  await win.evaluate(
    (sid) => window.api.meetingStop({ sessionId: sid }),
    st.sessionId,
  );
  await expect
    .poll(
      async () =>
        (
          await win.evaluate((nb) => window.api.sourceListByNotebook(nb), st.nb)
        )[0]?.meetingPhase,
      { timeout: opts.timeoutMs },
    )
    .toBe("done");
  // Thời lượng audio ±1 s so với lúc dừng (lô cuối có thể tới sau lần đọc trạng thái).
  const wav = statSync(join(dir, "meeting.wav")).size;
  const sec = (wav - 44) / 32000;
  expect(Math.abs(sec - (before?.durationSec ?? 0))).toBeLessThanOrEqual(
    opts.speed / 10 + 1,
  );
  await app.close();
}

test("ghi dài (bơm tăng tốc): 120 phân đoạn 5 s xoay tệp đúng, hoàn tất thành công", async () => {
  test.setTimeout(180_000);
  await soak({
    audioSec: 600,
    speed: 100,
    segmentSec: 5,
    expectSegments: 120,
    timeoutMs: 120_000,
  });
});

test("SC-001: 180 phút audio, phân đoạn mặc định 300 s ⇒ 36 phân đoạn, hoàn tất thành công", async () => {
  test.skip(process.env["IV_E2E_SOAK"] !== "1", "chỉ chạy khi IV_E2E_SOAK=1");
  test.setTimeout(900_000);
  await soak({
    audioSec: 180 * 60,
    speed: 300,
    expectSegments: 36,
    timeoutMs: 600_000,
  });
});
