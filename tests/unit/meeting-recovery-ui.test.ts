// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import type { RecoverableSession, Source } from "@shared/ipc/types";
import { I18nProvider } from "../../src/renderer/shared/i18n/I18nProvider";
import { MeetingRecoveryCard } from "../../src/renderer/features/meeting-capture/MeetingRecoveryCard";
import { MeetingSourceBanner } from "../../src/renderer/features/meeting-capture/MeetingSourceBanner";
import { DiskWarning } from "../../src/renderer/features/meeting-capture/DiskWarning";

// 186 PR C1 — giao diện phục hồi: thẻ phiên gián đoạn (3 hành động, Xoá cần xác nhận), banner "Hoàn tất transcript" /
// "Chốt lại" trong trình xem nguồn, cảnh báo đĩa. window.api là giả.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let api: Record<string, ReturnType<typeof vi.fn>>;
let recoverable: RecoverableSession[];
let source: Source | null;

const SESSION: RecoverableSession = {
  sessionId: "s1",
  sourceId: "m1",
  notebookId: "nb1",
  title: "Họp sáng",
  durationSec: 125,
  startedAt: 1,
};

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  recoverable = [SESSION];
  source = null;
  api = {
    getUiLanguage: vi.fn(() =>
      Promise.resolve({ preference: "vi", effective: "vi" }),
    ),
    onUiLanguageChanged: vi.fn(() => () => undefined),
    meetingListRecoverable: vi.fn(() => Promise.resolve(recoverable)),
    onMeetingRecoverable: vi.fn(() => () => undefined),
    meetingRecover: vi.fn(() => {
      recoverable = [];
      return Promise.resolve({ ok: true });
    }),
    sourceGet: vi.fn(() => Promise.resolve(source)),
    onSourceProgress: vi.fn(() => () => undefined),
    meetingFinalizeAgain: vi.fn(() => Promise.resolve({ ok: true })),
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

describe("MeetingRecoveryCard", () => {
  it("hiện thẻ với tiêu đề + thời lượng; Hoàn tất ⇒ recover finalize, thẻ biến mất", async () => {
    const onChanged = vi.fn();
    await mount(
      createElement(MeetingRecoveryCard, { notebookId: "nb1", onChanged }),
    );
    expect(api["meetingListRecoverable"]).toHaveBeenCalledWith({
      notebookId: "nb1",
    });
    expect(q("recovery-card")!.textContent).toContain("Họp sáng");
    expect(q("recovery-card")!.textContent).toContain("00:02:05");
    await act(async () => q("recovery-finalize")!.click());
    expect(api["meetingRecover"]).toHaveBeenCalledWith({
      sessionId: "s1",
      action: "finalize",
    });
    expect(q("recovery-card")).toBeNull();
    expect(onChanged).toHaveBeenCalled();
  });

  it("Xoá bản ghi cần xác nhận; Huỷ không xoá", async () => {
    await mount(createElement(MeetingRecoveryCard, { notebookId: "nb1" }));
    await act(async () => q("recovery-discard")!.click());
    expect(q("recovery-discard-confirm")).not.toBeNull();
    expect(api["meetingRecover"]).not.toHaveBeenCalled();
    await act(async () => q("recovery-discard-ok")!.click());
    expect(api["meetingRecover"]).toHaveBeenCalledWith({
      sessionId: "s1",
      action: "discard",
    });
  });

  it("không có phiên gián đoạn ⇒ không hiện gì", async () => {
    recoverable = [];
    await mount(createElement(MeetingRecoveryCard, { notebookId: "nb1" }));
    expect(q("recovery-cards")).toBeNull();
  });
});

describe("MeetingSourceBanner", () => {
  const meeting = (over: Partial<Source>): Source => ({
    id: "m1",
    notebookId: "nb1",
    kind: "meeting",
    title: "Họp",
    status: "ready",
    errorCode: null,
    pageCount: null,
    createdAt: 1,
    updatedAt: 1,
    extractionVersion: 1,
    ...over,
  });

  it("transcript nháp ⇒ nhãn + 'Chốt lại' gọi finalizeAgain", async () => {
    source = meeting({ meetingPhase: "done", transcriptQuality: "draft" });
    await mount(createElement(MeetingSourceBanner, { sourceId: "m1" }));
    expect(q("meeting-source-banner")!.textContent).toContain(
      "Transcript nháp",
    );
    expect(q("meeting-finalize-again")!.textContent).toBe("Chốt lại");
    await act(async () => q("meeting-finalize-again")!.click());
    expect(api["meetingFinalizeAgain"]).toHaveBeenCalledWith({
      sourceId: "m1",
    });
  });

  it("chưa hoàn thiện ⇒ 'Hoàn tất transcript'; đã chốt ⇒ không hiện", async () => {
    source = meeting({ meetingPhase: "incomplete" });
    await mount(createElement(MeetingSourceBanner, { sourceId: "m1" }));
    expect(q("meeting-finalize-again")!.textContent).toBe(
      "Hoàn tất transcript",
    );
    source = meeting({ meetingPhase: "done", transcriptQuality: "final" });
    await mount(createElement(MeetingSourceBanner, { sourceId: "m2" }));
    expect(q("meeting-source-banner")).toBeNull();
  });
});

describe("DiskWarning", () => {
  it("ok ⇒ không hiện; warn/urgent ⇒ số phút còn lại", async () => {
    await mount(createElement(DiskWarning, { level: "ok", minutes: 500 }));
    expect(q("disk-warning")).toBeNull();
    await mount(createElement(DiskWarning, { level: "warn", minutes: 25.7 }));
    expect(q("disk-warning")!.textContent).toContain("25 phút");
    await mount(createElement(DiskWarning, { level: "urgent", minutes: 3 }));
    expect(q("disk-warning")!.className).toContain("urgent");
  });
});
