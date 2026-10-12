import { test, expect } from "@playwright/test";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { launchFreshAt, dismissOnboarding } from "./helper";

// 186 — đường đi PHÍA MAIN của Ghi cuộc họp, không cần micro: renderer gọi window.api.meeting* và bơm PCM lấy từ fixture
// (thay worklet), ASR giả (IV_ASR_FAKE) trong utilityProcess thật. Kiểm: phân đoạn → hoàn tất → nguồn ready có chunk
// mang mốc thời gian → iv-media phục vụ meeting.wav → xoá nguồn xoá thư mục phiên.

const FIXTURE = join(process.cwd(), "tests/fixtures/meeting/speech-16k.wav");

test("ghi (PCM bơm từ fixture) → kết thúc → nguồn cuộc họp ready, có trích dẫn theo mốc, xoá được", async () => {
  test.setTimeout(90_000);
  const { app, userData } = await launchFreshAt({
    IV_ASR_FAKE: "1",
    IV_MEETING_SEGMENT_SEC: "20",
  });
  const win = await app.firstWindow();
  await dismissOnboarding(win);
  const pcm = readFileSync(FIXTURE).subarray(44); // 16 kHz mono PCM16

  // Bơm lô từ phía Node (timer renderer bị bóp khi cửa sổ chạy nền) — ≤ 4 lô/giây như giới hạn ở main.
  const started = await win.evaluate(async () => {
    const api = (
      window as unknown as {
        api: Record<string, (...a: unknown[]) => Promise<unknown>>;
      }
    ).api;
    const nb = (await api.notebookCreate({
      name: "Họp e2e",
      color: "#1E6B57",
    })) as { id: string };
    const prep = (await api.meetingPrepare({ notebookId: nb.id })) as {
      canStart: boolean;
    };
    const st = (await api.meetingStart({
      notebookId: nb.id,
      title: "Cuộc họp e2e",
      languageMode: "vi",
    })) as { sessionId: string; sourceId: string };
    return { notebookId: nb.id, canStart: prep.canStart, ...st };
  });
  for (let off = 0, seq = 0; off < pcm.length; off += 32000, seq++) {
    const chunk = pcm.subarray(off, Math.min(pcm.length, off + 32000));
    const b64 = chunk
      .subarray(0, chunk.length - (chunk.length % 2))
      .toString("base64");
    await win.evaluate(
      ({ sessionId, seq, b64 }) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        (
          window as unknown as {
            api: { meetingSendAudio: (b: unknown) => void };
          }
        ).api.meetingSendAudio({ sessionId, seq, pcm: bytes.buffer });
      },
      { sessionId: started.sessionId, seq, b64 },
    );
    await new Promise((r) => setTimeout(r, 260));
  }
  const result = await win.evaluate(async (s) => {
    const api = (
      window as unknown as {
        api: Record<string, (...a: unknown[]) => Promise<unknown>>;
      }
    ).api;
    const status = (await api.meetingStatus()) as {
      durationSec: number;
      segments: unknown[];
    };
    await api.meetingStop({ sessionId: s.sessionId });
    return { ...s, status };
  }, started);

  expect(result.canStart).toBe(true);
  expect(result.status.durationSec).toBeGreaterThan(50);
  expect(result.status.segments.length).toBeGreaterThanOrEqual(3);

  // Chờ hoàn tất + lập chỉ mục.
  await expect
    .poll(
      async () =>
        win.evaluate(async (id) => {
          const api = (
            window as unknown as {
              api: Record<string, (...a: unknown[]) => Promise<unknown>>;
            }
          ).api;
          const s = (await api.sourceGet(id)) as {
            status: string;
            meetingPhase?: string;
          } | null;
          return s ? `${s.status}/${s.meetingPhase}` : "none";
        }, result.sourceId),
      { timeout: 60_000 },
    )
    .toBe("ready/done");

  const sessionDir = join(userData, "meetings", result.sessionId);
  expect(existsSync(join(sessionDir, "meeting.wav"))).toBe(true);
  expect(readdirSync(sessionDir).filter((f) => f.startsWith("seg-"))).toEqual(
    [],
  );

  const content = await win.evaluate(async (id) => {
    const api = (
      window as unknown as {
        api: Record<string, (...a: unknown[]) => Promise<unknown>>;
      }
    ).api;
    return (await api.sourceGetContent(id)) as {
      kind: string;
      text: string;
    } | null;
  }, result.sourceId);
  expect(content?.kind).toBe("meeting");
  expect(content?.text).toContain("đoạn 1");

  // iv-media phục vụ meeting.wav cho <audio> (media-src iv-media:; renderer không fetch — connect-src 'self').
  const durationSec = await win.evaluate(
    (id) =>
      new Promise<number>((resolve, reject) => {
        const a = new Audio(`iv-media://source/${encodeURIComponent(id)}`);
        a.addEventListener("loadedmetadata", () => resolve(a.duration), {
          once: true,
        });
        a.addEventListener("error", () => reject(new Error("media error")), {
          once: true,
        });
      }),
    result.sourceId,
  );
  expect(Math.abs(durationSec - result.status.durationSec)).toBeLessThan(1);

  await win.evaluate(async (id) => {
    const api = (
      window as unknown as {
        api: Record<string, (...a: unknown[]) => Promise<unknown>>;
      }
    ).api;
    await api.sourceDelete(id);
  }, result.sourceId);
  expect(existsSync(sessionDir)).toBe(false);
  await app.close();
});
