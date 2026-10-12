// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { SourceViewer } from "../../src/renderer/features/source-viewer/SourceViewer";
import type { SourceViewerState } from "../../src/renderer/features/source-viewer/useSourceViewer";
import type { Citation, SourceContent } from "../../src/shared/ipc/types";

// 049 component test — render player khi kind=audio + seek effect (chờ loadedmetadata → currentTime=tStart)
// + onError khi file gốc mất. 186 (quyết định C1, thay 049 #3): mở trích dẫn CHỈ TUA, không tự phát — cho mọi
// audio/video/cuộc họp. jsdom không thực thi media thật nên ta override currentTime/play trên
// element để bắt side-effect tất định.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const audioContent: SourceContent = {
  kind: "audio",
  title: "Ghi âm phỏng vấn",
  pageCount: 0,
  text: "xin chào đây là nội dung bóc băng",
  pageBreaks: [],
};

function citation(tStart: number): Citation {
  return {
    n: 1,
    chunkId: "c1",
    sourceId: "aud 1", // có khoảng trắng → kiểm encodeURIComponent
    sourceTitle: "Ghi âm phỏng vấn",
    locator: { page: 1, charStart: 0, charEnd: 5, tStart, tEnd: tStart + 3 },
  };
}

function viewerState(over: Partial<SourceViewerState>): SourceViewerState {
  return {
    target: { sourceId: "aud 1", citation: citation(12.5) },
    content: audioContent,
    loading: false,
    missing: false,
    isOpen: true,
    open: vi.fn(),
    openCitation: vi.fn(),
    openSource: vi.fn(),
    close: vi.fn(),
    ...over,
  } as SourceViewerState;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // jsdom không cài scrollIntoView (auto-scroll tới highlight gọi nó) — stub để không ném.
  Element.prototype.scrollIntoView = vi.fn();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(viewer: SourceViewerState): void {
  act(() => root.render(createElement(SourceViewer, { viewer })));
}

describe("SourceViewer audio player (049)", () => {
  it("render <audio> với src iv-media:// + sourceId đã encode khi kind=audio", () => {
    render(viewerState({}));
    const player = container.querySelector<HTMLElement>(
      '[data-testid="viewer-audio-player"]',
    );
    expect(player).not.toBeNull();
    const audio = container.querySelector("audio");
    expect(audio?.getAttribute("src")).toBe("iv-media://source/aud%201");
  });

  it("186/C1: seek tới tStart sau loadedmetadata, KHÔNG tự phát (readyState=0 lúc mount)", () => {
    render(viewerState({}));
    const audio = container.querySelector("audio") as HTMLAudioElement;
    let seeked = -1;
    Object.defineProperty(audio, "currentTime", {
      get: () => seeked,
      set: (v: number) => {
        seeked = v;
      },
      configurable: true,
    });
    const play = vi.fn().mockResolvedValue(undefined);
    audio.play = play as unknown as HTMLAudioElement["play"];

    act(() => {
      audio.dispatchEvent(new Event("loadedmetadata"));
    });
    expect(seeked).toBe(12.5);
    expect(play).not.toHaveBeenCalled();
  });

  it("186/C1: đổi sang trích dẫn khác khi đang phát ⇒ tua tới mốc mới + dừng phát", () => {
    render(viewerState({}));
    const audio = container.querySelector("audio") as HTMLAudioElement;
    let seeked = -1;
    Object.defineProperty(audio, "currentTime", {
      get: () => seeked,
      set: (v: number) => {
        seeked = v;
      },
      configurable: true,
    });
    Object.defineProperty(audio, "readyState", {
      get: () => 1,
      configurable: true,
    });
    const play = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn();
    audio.play = play as unknown as HTMLAudioElement["play"];
    audio.pause = pause;
    render(
      viewerState({ target: { sourceId: "aud 1", citation: citation(40) } }),
    );
    expect(seeked).toBe(40);
    expect(pause).toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it("186: kind=meeting ⇒ player audio iv-media:// + chỉ tua", () => {
    const meeting: SourceContent = {
      ...audioContent,
      kind: "meeting",
      title: "Cuộc họp 12/10, 14:30",
    };
    render(
      viewerState({
        content: meeting,
        target: {
          sourceId: "m 1",
          citation: { ...citation(605), sourceId: "m 1" },
        },
      }),
    );
    const audio = container.querySelector("audio") as HTMLAudioElement | null;
    expect(audio).not.toBeNull();
    expect(audio?.getAttribute("src")).toBe("iv-media://source/m%201");
    let seeked = -1;
    Object.defineProperty(audio as HTMLAudioElement, "currentTime", {
      get: () => seeked,
      set: (v: number) => {
        seeked = v;
      },
      configurable: true,
    });
    const play = vi.fn().mockResolvedValue(undefined);
    (audio as HTMLAudioElement).play =
      play as unknown as HTMLAudioElement["play"];
    act(() => {
      (audio as HTMLAudioElement).dispatchEvent(new Event("loadedmetadata"));
    });
    expect(seeked).toBe(605);
    expect(play).not.toHaveBeenCalled();
  });

  it("onError (file gốc 404) → hiện thông báo, không ném lỗi", () => {
    render(viewerState({}));
    expect(
      container.querySelector('[data-testid="viewer-audio-error"]'),
    ).toBeNull();
    const audio = container.querySelector("audio") as HTMLAudioElement;
    act(() => {
      audio.dispatchEvent(new Event("error"));
    });
    const err = container.querySelector('[data-testid="viewer-audio-error"]');
    expect(err).not.toBeNull();
    expect(err?.textContent).toContain("Không phát được");
  });

  it("nguồn không phải audio → không render player", () => {
    const pdf: SourceContent = {
      kind: "pdf",
      title: "Tài liệu",
      pageCount: 1,
      text: "abc",
      pageBreaks: [],
    };
    render(
      viewerState({
        content: pdf,
        target: { sourceId: "p1", citation: null },
      }),
    );
    expect(
      container.querySelector('[data-testid="viewer-audio-player"]'),
    ).toBeNull();
  });

  it("051: kind=video → render <video> (không <audio>) + seek tới tStart, không tự phát (186/C1)", () => {
    const video: SourceContent = {
      kind: "video",
      title: "Phỏng vấn.mp4",
      pageCount: 0,
      text: "xin chào đây là video",
      pageBreaks: [],
    };
    render(
      viewerState({
        content: video,
        target: { sourceId: "vid 1", citation: citation(8) },
      }),
    );
    const el = container.querySelector(
      '[data-testid="viewer-video-el"]',
    ) as HTMLVideoElement | null;
    expect(el).not.toBeNull();
    expect(el?.tagName).toBe("VIDEO");
    expect(el?.getAttribute("src")).toBe("iv-media://source/vid%201");
    expect(container.querySelector("audio")).toBeNull();

    let seeked = -1;
    Object.defineProperty(el as HTMLVideoElement, "currentTime", {
      get: () => seeked,
      set: (v: number) => {
        seeked = v;
      },
      configurable: true,
    });
    const vplay = vi.fn().mockResolvedValue(undefined);
    (el as HTMLVideoElement).play =
      vplay as unknown as HTMLVideoElement["play"];
    act(() => {
      (el as HTMLVideoElement).dispatchEvent(new Event("loadedmetadata"));
    });
    expect(seeked).toBe(8);
    expect(vplay).not.toHaveBeenCalled();
  });
});
