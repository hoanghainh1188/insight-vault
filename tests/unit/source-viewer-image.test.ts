// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { SourceViewer } from "../../src/renderer/features/source-viewer/SourceViewer";
import type { SourceViewerState } from "../../src/renderer/features/source-viewer/useSourceViewer";
import type { Citation, SourceContent } from "../../src/shared/ipc/types";

// 053 component test — <img> khi kind=image + overlay bbox (%) khi có citation.locator.bbox + onError.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const imageContent: SourceContent = {
  kind: "image",
  title: "hoa-don.png",
  pageCount: 0,
  text: "hoá đơn tiền điện",
  pageBreaks: [],
};

function citation(withBbox: boolean): Citation {
  return {
    n: 1,
    chunkId: "c1",
    sourceId: "img 1",
    sourceTitle: "hoa-don.png",
    locator: {
      page: 1,
      charStart: 0,
      charEnd: 7,
      ...(withBbox ? { bbox: { x: 0.1, y: 0.2, w: 0.3, h: 0.15 } } : {}),
    },
  };
}

function viewerState(over: Partial<SourceViewerState>): SourceViewerState {
  return {
    target: { sourceId: "img 1", citation: citation(true) },
    content: imageContent,
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

describe("SourceViewer image (053)", () => {
  it("kind=image → <img> src iv-media encoded + overlay bbox theo %", () => {
    render(viewerState({}));
    const img = container.querySelector(
      '[data-testid="viewer-image-el"]',
    ) as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("iv-media://source/img%201");
    const box = container.querySelector(
      '[data-testid="viewer-bbox"]',
    ) as HTMLElement | null;
    expect(box).not.toBeNull();
    expect(box?.style.left).toBe("10%");
    expect(box?.style.top).toBe("20%");
    expect(box?.style.width).toBe("30%");
    expect(box?.style.height).toBe("15%");
  });

  it("mở trực tiếp (citation=null) → có <img>, KHÔNG overlay bbox", () => {
    render(viewerState({ target: { sourceId: "img 1", citation: null } }));
    expect(
      container.querySelector('[data-testid="viewer-image-el"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="viewer-bbox"]')).toBeNull();
  });

  it("citation không có bbox → không overlay", () => {
    render(
      viewerState({
        target: { sourceId: "img 1", citation: citation(false) },
      }),
    );
    expect(container.querySelector('[data-testid="viewer-bbox"]')).toBeNull();
  });

  it("onError (ảnh gốc mất) → hiện thông báo", () => {
    render(viewerState({}));
    const img = container.querySelector("img") as HTMLImageElement;
    act(() => {
      img.dispatchEvent(new Event("error"));
    });
    const err = container.querySelector('[data-testid="viewer-image-error"]');
    expect(err).not.toBeNull();
    expect(err?.textContent).toContain("Không mở được ảnh");
  });

  it("nguồn không phải image → không render image player", () => {
    const pdf: SourceContent = {
      kind: "pdf",
      title: "t",
      pageCount: 1,
      text: "abc",
      pageBreaks: [],
    };
    render(
      viewerState({ content: pdf, target: { sourceId: "p1", citation: null } }),
    );
    expect(
      container.querySelector('[data-testid="viewer-image-player"]'),
    ).toBeNull();
  });
});
