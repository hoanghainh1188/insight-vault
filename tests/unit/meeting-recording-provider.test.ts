// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { MeetingState } from "@shared/ipc/types";

// 186 — RecordingProvider (review PR A S1): lô chờ trước khi có phiên, start lỗi tắt micro, mất thiết bị sớm, Tiếp tục
// lỗi quay về tạm dừng (B3), main tự kết thúc ⇒ tắt micro + màn hoàn tất có lý do (B1). Micro và window.api là giả.

interface FakeMic {
  opts: {
    onBatch: (pcm: ArrayBuffer) => void;
    onEnded: () => void;
    fakeTone?: boolean;
  };
  stop: ReturnType<typeof vi.fn>;
}
const mics: FakeMic[] = [];
let micFails = false;

vi.mock(
  "../../src/renderer/features/meeting-capture/capture/mic-capture",
  () => {
    class MicError extends Error {
      constructor(readonly code: string) {
        super(code);
      }
    }
    return {
      MicError,
      startMicCapture: vi.fn(async (opts: FakeMic["opts"]) => {
        if (micFails) throw new MicError("notFound");
        const m: FakeMic = { opts, stop: vi.fn(async () => undefined) };
        mics.push(m);
        return { stop: m.stop, deviceLabel: "Mic giả" };
      }),
    };
  },
);

const { RecordingProvider, useRecording, PENDING_FLUSH_MS } =
  await import("../../src/renderer/features/meeting-capture/RecordingProvider");
const { I18nProvider } =
  await import("../../src/renderer/shared/i18n/I18nProvider");

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type Rec = ReturnType<typeof useRecording>;
let rec!: Rec;
function Probe(): null {
  rec = useRecording();
  return null;
}

const live = (over: Partial<MeetingState> = {}): MeetingState => ({
  sessionId: "sess-1",
  sourceId: "src-1",
  notebookId: "nb1",
  title: "Họp",
  phase: "recording",
  durationSec: 3,
  segments: [],
  diskLevel: "ok",
  minutesRemaining: 100,
  transcriptLagging: false,
  language: { mode: "vi", current: "vi", status: "manual" },
  pauseGaps: [],
  modelReady: true,
  ...over,
});

let container: HTMLDivElement;
let root: Root;
let pushState: (s: MeetingState) => void;
let api: Record<string, ReturnType<typeof vi.fn>>;
let resolveStart: (v: { sessionId: string; sourceId: string }) => void;

beforeEach(async () => {
  mics.length = 0;
  micFails = false;
  api = {
    getUiLanguage: vi.fn(async () => ({ preference: "vi", effective: "vi" })),
    onUiLanguageChanged: vi.fn(() => () => undefined),
    onMeetingState: vi.fn((cb: (s: MeetingState) => void) => {
      pushState = cb;
      return () => undefined;
    }),
    onSourceProgress: vi.fn(() => () => undefined),
    meetingStatus: vi.fn(async () => null),
    meetingPrepare: vi.fn(async () => ({ canStart: true, testFakeMic: true })),
    meetingStart: vi.fn(
      () =>
        new Promise((r) => {
          resolveStart = r as typeof resolveStart;
        }),
    ),
    meetingSendAudio: vi.fn(),
    meetingPause: vi.fn(async () => live({ phase: "paused" })),
    meetingResume: vi.fn(async () => live()),
    meetingStop: vi.fn(async () => ({ sourceId: "src-1" })),
  };
  (window as unknown as { api: unknown }).api = api;
  container = document.createElement("div");
  root = createRoot(container);
  act(() =>
    root.render(
      createElement(
        I18nProvider,
        null,
        createElement(RecordingProvider, null, createElement(Probe)),
      ),
    ),
  );
  await act(async () => {});
});
afterEach(() => {
  act(() => root.unmount());
});

// Đồng hồ thật: act() của React 18 treo khi giả bộ hẹn giờ.
const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));
const pcm = (): ArrayBuffer => new ArrayBuffer(32000);

/** Trả { p } — trả thẳng promise từ hàm async sẽ bị "làm phẳng" (chờ luôn start xong). */
async function startSession(): Promise<{ p: Promise<unknown> }> {
  // start() còn treo (meetingStart chưa trả) ⇒ không bọc trong act (act chờ callback xong); chỉ xả vi nhiệm vụ.
  const p = rec.start({
    notebookId: "nb1",
    title: "Họp",
    languageMode: "auto",
  });
  await act(async () => {
    await sleep(10);
  });
  return { p };
}

describe("RecordingProvider", () => {
  it("lô đến trước khi có sessionId được giữ rồi xả theo nhịp, seq liên tục", async () => {
    const { p } = await startSession();
    mics[0]!.opts.onBatch(pcm());
    mics[0]!.opts.onBatch(pcm());
    await act(async () => {
      resolveStart({ sessionId: "sess-1", sourceId: "src-1" });
      await p;
    });
    expect(api.meetingSendAudio).toHaveBeenCalledTimes(1); // lô chờ đầu gửi ngay
    await act(async () => {
      await sleep(PENDING_FLUSH_MS * 2 + 60);
    });
    mics[0]!.opts.onBatch(pcm()); // sau khi xả xong: gửi thẳng
    const seqs = api.meetingSendAudio.mock.calls.map(
      (c) => (c[0] as { seq: number }).seq,
    );
    expect(seqs).toEqual([0, 1, 2]);
    expect(
      api.meetingSendAudio.mock.calls.every(
        (c) => (c[0] as { sessionId: string }).sessionId === "sess-1",
      ),
    ).toBe(true);
  });

  it("meetingStart lỗi sau khi micro đã mở ⇒ tắt micro, kết quả ipc", async () => {
    api.meetingStart!.mockRejectedValueOnce(
      new Error("[[err:meetingDiskLow]]"),
    );
    let r: unknown;
    await act(async () => {
      r = await rec.start({
        notebookId: "nb1",
        title: "Họp",
        languageMode: "auto",
      });
    });
    expect(r).toMatchObject({ ok: false, reason: "ipc" });
    expect(mics[0]!.stop).toHaveBeenCalled();
  });

  it("mất thiết bị TRƯỚC khi có phiên ⇒ ngay khi có phiên thì dừng micro + tạm dừng deviceLost", async () => {
    const { p } = await startSession();
    mics[0]!.opts.onEnded();
    await act(async () => {
      resolveStart({ sessionId: "sess-1", sourceId: "src-1" });
      await p;
      await sleep(20);
    });
    expect(mics[0]!.stop).toHaveBeenCalled();
    expect(api.meetingPause).toHaveBeenCalledWith({
      sessionId: "sess-1",
      reason: "deviceLost",
    });
  });

  it("B3: Tiếp tục mà không mở được micro ⇒ quay về tạm dừng deviceLost", async () => {
    const { p } = await startSession();
    await act(async () => {
      resolveStart({ sessionId: "sess-1", sourceId: "src-1" });
      await p;
      pushState(live());
    });
    await act(async () => {
      await rec.pause();
    });
    micFails = true;
    await act(async () => {
      await rec.resume();
    });
    expect(api.meetingResume).toHaveBeenCalled();
    expect(api.meetingPause).toHaveBeenLastCalledWith({
      sessionId: "sess-1",
      reason: "deviceLost",
    });
  });

  it("B1: main tự kết thúc (endReason) ⇒ tắt micro, bỏ trạng thái ghi, màn hoàn tất có lý do", async () => {
    const { p } = await startSession();
    await act(async () => {
      resolveStart({ sessionId: "sess-1", sourceId: "src-1" });
      await p;
      pushState(live());
    });
    expect(rec.state?.phase).toBe("recording");
    await act(async () => {
      pushState(live({ phase: "finalizing", endReason: "diskFull" }));
    });
    expect(mics[0]!.stop).toHaveBeenCalled();
    expect(rec.state).toBeNull();
    expect(rec.finalizing).toMatchObject({
      sourceId: "src-1",
      endReason: "diskFull",
      ready: false,
    });
  });

  it("push finalizing KHÔNG có endReason (người dùng tự kết thúc) không bị coi là main tự kết thúc", async () => {
    const { p } = await startSession();
    await act(async () => {
      resolveStart({ sessionId: "sess-1", sourceId: "src-1" });
      await p;
      pushState(live());
      pushState(live({ phase: "finalizing" }));
    });
    expect(rec.finalizing).toBeNull();
    expect(mics[0]!.stop).not.toHaveBeenCalled();
  });
});
