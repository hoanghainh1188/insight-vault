// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import type { MeetingTranscript } from "@shared/ipc/types";
import { I18nProvider } from "../../src/renderer/shared/i18n/I18nProvider";
import { MeetingViewer } from "../../src/renderer/features/meeting-capture/viewer/MeetingViewer";

// 186 PR C2 — trình xem cuộc họp: câu đang phát theo player (aria-current), bấm câu ⇒ tua, tìm (k/N, trước/sau), đánh dấu (tua,
// đổi nhãn, xoá có xác nhận), sao chép, xuất Markdown qua main.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const TEXT = "Chào mọi người. Hôm nay chốt ngân sách. Ngân sách tăng.";
const DATA: MeetingTranscript = {
  spans: [
    { charStart: 0, charEnd: 15, tStart: 0, tEnd: 5 },
    { charStart: 16, charEnd: 39, tStart: 5, tEnd: 12 },
    { charStart: 40, charEnd: 55, tStart: 12, tEnd: 20 },
  ],
  markers: [
    {
      id: "k1",
      kind: "decision",
      tStart: 6,
      tEnd: 6,
      excerpt: "Hôm nay chốt ngân sách.",
    },
  ],
  pauseGaps: [{ atSec: 10, wallSeconds: 60, reason: "user" }],
  language: "vi",
  quality: "final",
  durationSec: 20,
  startedAt: 1,
  endedAt: 2,
};

let container: HTMLDivElement;
let root: Root;
let api: Record<string, ReturnType<typeof vi.fn>>;
let audio: HTMLAudioElement;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  audio = document.createElement("audio");
  api = {
    getUiLanguage: vi.fn(() =>
      Promise.resolve({ preference: "vi", effective: "vi" }),
    ),
    onUiLanguageChanged: vi.fn(() => () => undefined),
    meetingGetTranscript: vi.fn(() => Promise.resolve(DATA)),
    meetingUpdateMarker: vi.fn(() => Promise.resolve({ ok: true })),
    meetingDeleteMarker: vi.fn(() => Promise.resolve({ ok: true })),
    meetingExportMarkdown: vi.fn(() =>
      Promise.resolve({ saved: true, path: "/tmp/h.md" }),
    ),
    clipboardWrite: vi.fn(() => Promise.resolve({ ok: true })),
  };
  (window as unknown as { api: unknown }).api = api;
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function mount(
  highlight: { charStart: number; charEnd: number } | null = null,
): Promise<void> {
  const ref = createRef<HTMLMediaElement | null>() as {
    current: HTMLMediaElement | null;
  };
  ref.current = audio;
  act(() =>
    root.render(
      createElement(
        I18nProvider,
        null,
        createElement(MeetingViewer, {
          sourceId: "m1",
          text: TEXT,
          audio: ref,
          highlight,
        }),
      ),
    ),
  );
  await act(async () => {});
}
const q = (id: string): HTMLElement | null =>
  container.querySelector(`[data-testid="${id}"]`);
const all = (id: string): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`),
];

describe("MeetingViewer", () => {
  it("câu theo span + dòng tạm dừng; câu đang phát theo timeupdate có aria-current", async () => {
    await mount();
    expect(all("meeting-span")).toHaveLength(3);
    expect(container.querySelector(".mview-gap")?.textContent).toContain(
      "Tạm dừng 00:01:00",
    );
    audio.currentTime = 7;
    act(() => {
      audio.dispatchEvent(new Event("timeupdate"));
    });
    expect(all("meeting-span")[1]?.getAttribute("aria-current")).toBe("true");
    expect(all("meeting-span")[0]?.getAttribute("aria-current")).toBeNull();
  });

  it("bấm câu ⇒ tua tới tStart", async () => {
    await mount();
    act(() => all("meeting-span")[2]?.querySelector("button")?.click());
    expect(audio.currentTime).toBe(12);
  });

  it("trích dẫn tô câu giao với đoạn trích", async () => {
    await mount({ charStart: 20, charEnd: 30 });
    expect(all("meeting-span")[1]?.className).toContain("hl");
    expect(all("meeting-span")[0]?.className).not.toContain("hl");
  });

  it("tìm bỏ dấu: đếm k/N, Enter sang kết quả sau", async () => {
    await mount();
    const input = q("meeting-search") as HTMLInputElement;
    act(() => {
      const set = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      set.call(input, "ngan sach");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(q("meeting-search-count")!.textContent).toBe("1/2");
    expect(container.querySelectorAll("mark")).toHaveLength(2);
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    expect(q("meeting-search-count")!.textContent).toBe("2/2");
    expect(container.querySelector("mark.current")?.textContent).toBe(
      "Ngân sách",
    );
  });

  it("đánh dấu: bấm ⇒ tua; đổi nhãn; xoá cần xác nhận", async () => {
    await mount();
    act(() => q("meeting-marker")!.click());
    expect(audio.currentTime).toBe(6);
    await act(async () => q("meeting-marker-kind")!.click());
    await act(async () => q("meeting-marker-kind-question")!.click());
    expect(api["meetingUpdateMarker"]).toHaveBeenCalledWith({
      markerId: "k1",
      kind: "question",
    });
    await act(async () => q("meeting-marker-delete")!.click());
    expect(api["meetingDeleteMarker"]).not.toHaveBeenCalled();
    await act(async () => q("meeting-marker-delete-ok")!.click());
    expect(api["meetingDeleteMarker"]).toHaveBeenCalledWith({ markerId: "k1" });
  });

  it("sao chép có timestamp; xuất Markdown chỉ gửi sourceId", async () => {
    await mount();
    await act(async () => q("meeting-copy")!.click());
    const copied = api["clipboardWrite"]!.mock.calls[0]?.[0] as string;
    expect(copied.split("\n")[0]).toBe("[00:00:00] Chào mọi người.");
    expect(copied).toContain("Tạm dừng 00:01:00");
    await act(async () => q("meeting-export")!.click());
    expect(api["meetingExportMarkdown"]).toHaveBeenCalledWith({
      sourceId: "m1",
    });
  });

  it("review C2: Esc trong ô tìm chỉ xoá ô tìm, không lan tới window (không đóng trình xem)", async () => {
    await mount();
    const onWindowKey = vi.fn();
    window.addEventListener("keydown", onWindowKey);
    const input = q("meeting-search") as HTMLInputElement;
    act(() => {
      const set = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      set.call(input, "ngan");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    window.removeEventListener("keydown", onWindowKey);
    expect(input.value).toBe("");
    expect(onWindowKey).not.toHaveBeenCalled();
  });

  it("review C2: đổi nhãn lỗi ⇒ báo lỗi (không nuốt); khoảng ngừng đọc được (separator)", async () => {
    api["meetingUpdateMarker"] = vi.fn(() =>
      Promise.reject(new Error("meetingNotFound")),
    );
    await mount();
    expect(
      container.querySelector('.mview-gap[role="separator"]'),
    ).not.toBeNull();
    await act(async () => q("meeting-marker-kind")!.click());
    await act(async () => q("meeting-marker-kind-question")!.click());
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });
});
