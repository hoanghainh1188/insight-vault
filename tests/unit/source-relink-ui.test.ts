// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { SourceViewer } from "../../src/renderer/features/source-viewer/SourceViewer";
import type { SourceViewerState } from "../../src/renderer/features/source-viewer/useSourceViewer";
import { SourceItem } from "../../src/renderer/features/sources/SourceItem";
import { relinkMessage } from "../../src/renderer/features/sources/relink-messages";
import type { Source, SourceContent } from "../../src/shared/ipc/types";

// 101 — "Chọn lại tệp gốc…": trình xem nguồn (media lỗi) + cột Nguồn (nguồn lỗi). Thành công ⇒ phát lại / thử lại;
// khác nội dung ⇒ giải thích vì sao từ chối (trích dẫn sẽ sai).

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let sourceRelink: ReturnType<typeof vi.fn>;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  sourceRelink = vi.fn(() => Promise.resolve({ status: "ok" }));
  (window as unknown as { api: unknown }).api = {
    sourceRelink,
    onSourceProgress: () => () => {}, // 112: SourceItem nghe tiến độ "Xử lý lại"
  };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const btn = (text: string): HTMLButtonElement | undefined =>
  Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(text),
  );

describe("relinkMessage", () => {
  it("câu giải thích theo kết quả; huỷ thì im lặng", () => {
    expect(relinkMessage("cancelled")).toBeNull();
    expect(relinkMessage("ok")).toMatch(/Đã liên kết lại/);
    expect(relinkMessage("mismatch")).toMatch(/khác nội dung/);
    expect(relinkMessage("mismatch")).toMatch(/nguồn mới/);
    expect(relinkMessage("wrongType")).toMatch(/không đúng loại/);
    expect(relinkMessage("error")).toMatch(/Không đọc được/);
    expect(relinkMessage("notApplicable")).toMatch(/không có tệp gốc/);
    expect(relinkMessage("busy")).toMatch(/đang được xử lý/);
    expect(relinkMessage("locked")).toMatch(/sao lưu\/khôi phục/);
  });
});

const imageContent: SourceContent = {
  kind: "image",
  title: "scan.png",
  pageCount: 0,
  text: "chữ trong ảnh",
  pageBreaks: [],
};

function viewer(): SourceViewerState {
  return {
    target: {
      sourceId: "img1",
      citation: {
        n: 1,
        chunkId: "c1",
        sourceId: "img1",
        sourceTitle: "scan.png",
        locator: { page: 1, charStart: 0, charEnd: 4 },
      },
    },
    content: imageContent,
    loading: false,
    missing: false,
    isOpen: true,
    open: vi.fn(),
    openCitation: vi.fn(),
    openSource: vi.fn(),
    close: vi.fn(),
  } as unknown as SourceViewerState;
}

describe("SourceViewer — ảnh gốc mất", () => {
  it("lỗi tải ảnh ⇒ nút chọn lại; thành công ⇒ hết lỗi + nạp lại ảnh (src đổi)", async () => {
    act(() => root.render(createElement(SourceViewer, { viewer: viewer() })));
    const img = container.querySelector<HTMLImageElement>(
      "[data-testid=viewer-image-el]",
    )!;
    act(() => void img.dispatchEvent(new Event("error")));
    expect(
      container.querySelector("[data-testid=viewer-image-error]"),
    ).not.toBeNull();
    await act(async () => btn("Chọn lại tệp gốc")!.click());
    expect(sourceRelink).toHaveBeenCalledWith("img1");
    expect(
      container.querySelector("[data-testid=viewer-image-error]"),
    ).toBeNull();
    expect(
      container
        .querySelector<HTMLImageElement>("[data-testid=viewer-image-el]")!
        .getAttribute("src"),
    ).toBe("iv-media://source/img1?r=1");
  });

  it("khác nội dung ⇒ giữ lỗi + giải thích", async () => {
    sourceRelink.mockImplementationOnce(() =>
      Promise.resolve({ status: "mismatch" }),
    );
    act(() => root.render(createElement(SourceViewer, { viewer: viewer() })));
    const img = container.querySelector<HTMLImageElement>(
      "[data-testid=viewer-image-el]",
    )!;
    act(() => void img.dispatchEvent(new Event("error")));
    await act(async () => btn("Chọn lại tệp gốc")!.click());
    expect(container.textContent).toMatch(/khác nội dung/);
    expect(
      container.querySelector("[data-testid=viewer-image-error]"),
    ).not.toBeNull();
  });
});

const errSource = (kind: Source["kind"]): Source =>
  ({
    id: "s1",
    notebookId: "nb1",
    kind,
    title: "phong-van.mp3",
    status: "error",
    errorLabel: "Không đọc được tệp.",
  }) as Source;

describe("SourceItem — nguồn lỗi", () => {
  const render = (s: Source, onRetry = vi.fn()) => {
    act(() =>
      root.render(
        createElement(
          "ul",
          null,
          createElement(SourceItem, { source: s, onRetry, onDelete: vi.fn() }),
        ),
      ),
    );
    return onRetry;
  };

  it("nguồn tệp lỗi ⇒ nút 'Chọn lại tệp…'; thành công ⇒ tự Thử lại", async () => {
    const onRetry = render(errSource("audio"));
    await act(async () => btn("Chọn lại tệp")!.click());
    expect(sourceRelink).toHaveBeenCalledWith("s1");
    expect(onRetry).toHaveBeenCalledWith("s1");
  });

  it("khác nội dung ⇒ không thử lại, hiện giải thích", async () => {
    sourceRelink.mockImplementationOnce(() =>
      Promise.resolve({ status: "mismatch" }),
    );
    const onRetry = render(errSource("audio"));
    await act(async () => btn("Chọn lại tệp")!.click());
    expect(onRetry).not.toHaveBeenCalled();
    expect(
      container.querySelector("[data-testid=source-relink-msg]")?.textContent,
    ).toMatch(/khác nội dung/);
  });

  it("nguồn URL lỗi ⇒ không có nút chọn lại tệp", () => {
    render(errSource("url"));
    expect(btn("Chọn lại tệp")).toBeUndefined();
  });
});
