// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import type { MeetingDraftEvent, MeetingState } from "@shared/ipc/types";
import { I18nProvider } from "../../src/renderer/shared/i18n/I18nProvider";
import { DraftTranscript } from "../../src/renderer/features/meeting-capture/DraftTranscript";
import { LanguageControl } from "../../src/renderer/features/meeting-capture/LanguageControl";
import { MarkerMenu } from "../../src/renderer/features/meeting-capture/MarkerMenu";

// 186 PR B — giao diện màn ghi: transcript nháp (push meeting:draft, "Đang nhận dạng", thiếu model, chậm), điều khiển ngôn
// ngữ (chỉ khoá khi CHỌN mục menu — không như <select>), đánh dấu. window.api là giả.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let draftCb: ((e: MeetingDraftEvent) => void) | null;
let api: Record<string, ReturnType<typeof vi.fn>>;

const STATE: MeetingState = {
  sessionId: "s1",
  sourceId: "src1",
  notebookId: "nb1",
  title: "Họp",
  phase: "recording",
  durationSec: 40,
  segments: [{ index: 0, durationSec: 40, closed: false }],
  diskLevel: "ok",
  minutesRemaining: 600,
  transcriptLagging: false,
  modelReady: true,
  language: { mode: "auto", current: null, status: "detecting" },
  pauseGaps: [],
};

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  draftCb = null;
  api = {
    getUiLanguage: vi.fn(() =>
      Promise.resolve({ preference: "vi", effective: "vi" }),
    ),
    onUiLanguageChanged: vi.fn(() => () => undefined),
    onMeetingDraft: vi.fn((cb: (e: MeetingDraftEvent) => void) => {
      draftCb = cb;
      return () => undefined;
    }),
    meetingStatus: vi.fn(() => Promise.resolve(null)),
    meetingSetLanguage: vi.fn(() => Promise.resolve(STATE)),
    meetingMark: vi.fn(() => Promise.resolve({ markerId: "k1" })),
    meetingListMarkers: vi.fn(() => Promise.resolve([])),
    meetingDownloadModel: vi.fn(() => Promise.resolve({ ok: true })),
  };
  (window as unknown as { api: unknown }).api = api;
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function mount(el: ReactElement): Promise<void> {
  act(() => root.render(createElement(I18nProvider, null, el)));
  await act(async () => {});
}
const q = (id: string): HTMLElement | null =>
  container.querySelector(`[data-testid="${id}"]`);
const all = (id: string): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`),
];

describe("DraftTranscript", () => {
  const draft = (state = STATE) =>
    createElement(DraftTranscript, {
      state,
      modelSizeMb: 150,
      onSelectRange: () => undefined,
    });

  it("gắn lại ⇒ hỏi meeting:status (main đẩy lại đủ dòng); dòng hiện timestamp, dòng pending có nhãn", async () => {
    await mount(draft());
    expect(api["meetingStatus"]).toHaveBeenCalled();
    act(() =>
      draftCb?.({
        sessionId: "s1",
        full: false,
        windows: [
          { id: "w0", tStart: 0, tEnd: 10, text: "Xin chào", pending: false },
          { id: "w1", tStart: 10, tEnd: 15, text: "mọi", pending: true },
        ],
      }),
    );
    const lines = all("draft-line");
    expect(lines).toHaveLength(2);
    expect(lines[0]!.textContent).toContain("00:00:00");
    expect(lines[0]!.textContent).toContain("Xin chào");
    expect(lines[1]!.textContent).toContain("Đang nhận dạng");
  });

  it("bỏ qua push của phiên khác", async () => {
    await mount(draft());
    act(() =>
      draftCb?.({
        sessionId: "khác",
        full: true,
        windows: [{ id: "w0", tStart: 0, tEnd: 10, text: "x", pending: false }],
      }),
    );
    expect(all("draft-line")).toHaveLength(0);
  });

  it("thiếu model ⇒ thông báo + nút tải gọi meeting:downloadModel; chậm ⇒ thông báo", async () => {
    await mount(
      draft({ ...STATE, modelReady: false, transcriptLagging: true }),
    );
    expect(q("draft-model-missing")!.textContent).toContain("150 MB");
    expect(q("draft-lagging")).not.toBeNull();
    await act(async () => q("draft-download-model")!.click());
    expect(api["meetingDownloadModel"]).toHaveBeenCalledTimes(1);
  });
});

describe("LanguageControl", () => {
  it("đang nhận dạng ⇒ nhãn; khoá ⇒ '<ngôn ngữ> · Tự động'", async () => {
    await mount(createElement(LanguageControl, { state: STATE }));
    expect(q("recording-language-status")!.textContent).toBe(
      "Đang nhận dạng ngôn ngữ…",
    );
    await mount(
      createElement(LanguageControl, {
        state: {
          ...STATE,
          language: { mode: "auto", current: "vi", status: "locked" },
        },
      }),
    );
    expect(q("recording-language-status")!.textContent).toBe(
      "Tiếng Việt · Tự động",
    );
  });

  it("chỉ khoá khi CHỌN mục trong menu; Esc đóng menu không gửi gì", async () => {
    await mount(createElement(LanguageControl, { state: STATE }));
    await act(async () => q("recording-language-change")!.click());
    act(() =>
      container
        .querySelector('[role="menu"]')!
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        ),
    );
    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(api["meetingSetLanguage"]).not.toHaveBeenCalled();
    await act(async () => q("recording-language-change")!.click());
    await act(async () => q("recording-language-lock-en")!.click());
    expect(api["meetingSetLanguage"]).toHaveBeenCalledWith({
      sessionId: "s1",
      action: "lock",
      lang: "en",
    });
  });

  it("gợi ý ⇒ Đồng ý / Không gửi đúng hành động", async () => {
    await mount(
      createElement(LanguageControl, {
        state: {
          ...STATE,
          language: {
            mode: "auto",
            current: "vi",
            status: "locked",
            suggestion: "en",
          },
        },
      }),
    );
    const box = q("recording-language-suggest")!;
    expect(box.textContent).toContain("English");
    const [accept, dismiss] = [...box.querySelectorAll("button")];
    await act(async () => accept!.click());
    await act(async () => dismiss!.click());
    expect(api["meetingSetLanguage"]).toHaveBeenNthCalledWith(1, {
      sessionId: "s1",
      action: "acceptSuggestion",
    });
    expect(api["meetingSetLanguage"]).toHaveBeenNthCalledWith(2, {
      sessionId: "s1",
      action: "dismissSuggestion",
    });
  });
});

describe("MarkerMenu", () => {
  it("không có vùng chọn ⇒ đánh dấu điểm tại thời điểm hiện tại; có ⇒ đánh dấu khoảng", async () => {
    const onMarked = vi.fn();
    const menu = (range: { tStart: number; tEnd: number } | null) =>
      createElement(MarkerMenu, {
        sessionId: "s1",
        sourceId: "src1",
        durationSec: 42,
        range,
        onMarked,
      });
    await mount(menu(null));
    await act(async () => q("recording-mark")!.click());
    await act(async () => q("recording-mark-decision")!.click());
    expect(api["meetingMark"]).toHaveBeenLastCalledWith({
      sessionId: "s1",
      kind: "decision",
      tStart: 42,
    });
    await mount(menu({ tStart: 10, tEnd: 30 }));
    expect(q("recording-mark")!.textContent).toBe("Đánh dấu đoạn đã chọn");
    await act(async () => q("recording-mark")!.click());
    await act(async () => q("recording-mark-question")!.click());
    expect(api["meetingMark"]).toHaveBeenLastCalledWith({
      sessionId: "s1",
      kind: "question",
      tStart: 10,
      tEnd: 30,
    });
    expect(onMarked).toHaveBeenCalledTimes(2);
  });
});
