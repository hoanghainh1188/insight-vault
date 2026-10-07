// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { SourceViewer } from "../../src/renderer/features/source-viewer/SourceViewer";
import {
  useSourceViewer,
  type SourceViewerState,
} from "../../src/renderer/features/source-viewer/useSourceViewer";
import type { Citation, SourceContent } from "../../src/shared/ipc/types";

// 112 (FR-017/018, SC-004): trích dẫn cũ (nguồn đã được xử lý lại) ⇒ mở nguồn, KHÔNG tô sáng, có ghi chú. Chip từ
// Chat và từ Studio cùng đi qua Workspace → viewer.openCitation ⇒ cùng hành vi.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let sourceGetContent: ReturnType<typeof vi.fn>;

const pdf = (citationValid?: boolean): SourceContent => ({
  kind: "pdf",
  title: "doc.pdf",
  pageCount: 2,
  text: "Trang mot noi dung.\n\nTrang hai noi dung.",
  pageBreaks: [
    { page: 1, offset: 0 },
    { page: 2, offset: 21 },
  ],
  ...(citationValid === undefined ? {} : { citationValid }),
});

const cite: Citation = {
  n: 2,
  chunkId: "chunk-cu",
  sourceId: "s1",
  sourceTitle: "doc.pdf",
  locator: { page: 2, charStart: 21, charEnd: 30 },
};

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  sourceGetContent = vi.fn(() => Promise.resolve(pdf(false)));
  (window as unknown as { api: unknown }).api = { sourceGetContent };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function stateWith(
  content: SourceContent,
  citation: Citation | null,
): SourceViewerState {
  return {
    target: { sourceId: "s1", citation },
    content,
    loading: false,
    missing: false,
    isOpen: true,
    open: vi.fn(),
    openCitation: vi.fn(),
    openSource: vi.fn(),
    close: vi.fn(),
  } as unknown as SourceViewerState;
}

const note = () => container.querySelector("[data-testid=viewer-stale-note]");
const marks = () => container.querySelectorAll("mark");

describe("SourceViewer — trích dẫn cũ", () => {
  it("citationValid=false ⇒ không tô sáng, có ghi chú (role=status), cuộn tới trang của trích dẫn", () => {
    act(() =>
      root.render(
        createElement(SourceViewer, { viewer: stateWith(pdf(false), cite) }),
      ),
    );
    expect(marks()).toHaveLength(0);
    expect(note()?.textContent).toBe(
      "Nguồn đã được xử lý lại — vị trí trích dẫn cũ không còn chính xác",
    );
    expect(note()?.getAttribute("role")).toBe("status");
    expect(container.textContent).toContain("Trang 2/2");
  });

  it("citationValid=true hoặc không có ⇒ tô sáng như cũ, không ghi chú", () => {
    act(() =>
      root.render(
        createElement(SourceViewer, { viewer: stateWith(pdf(true), cite) }),
      ),
    );
    expect(marks().length).toBeGreaterThan(0);
    expect(note()).toBeNull();
    act(() =>
      root.render(
        createElement(SourceViewer, { viewer: stateWith(pdf(), cite) }),
      ),
    );
    expect(marks().length).toBeGreaterThan(0);
  });

  it("mở nguồn trực tiếp (không trích dẫn) ⇒ không ghi chú", () => {
    act(() =>
      root.render(
        createElement(SourceViewer, { viewer: stateWith(pdf(false), null) }),
      ),
    );
    expect(note()).toBeNull();
  });
});

describe("useSourceViewer — gửi chunkId (chip Chat lẫn chip Studio)", () => {
  function Harness({ onReady }: { onReady: (v: SourceViewerState) => void }) {
    const v = useSourceViewer();
    useEffect(() => {
      onReady(v);
    }, [v, onReady]);
    return null;
  }

  it("openCitation ⇒ sourceGetContent({sourceId, chunkId}); openSource ⇒ chỉ id", async () => {
    let v!: SourceViewerState;
    act(() => root.render(createElement(Harness, { onReady: (x) => (v = x) })));
    // Chip Studio và chip Chat cùng dùng viewer.openCitation (Workspace) — một đường duy nhất.
    await act(async () => v.openCitation(cite));
    expect(sourceGetContent).toHaveBeenLastCalledWith({
      sourceId: "s1",
      chunkId: "chunk-cu",
    });
    await act(async () => v.openSource("s2"));
    expect(sourceGetContent).toHaveBeenLastCalledWith("s2");
  });
});
