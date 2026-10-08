// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { SourceItem } from "../../src/renderer/features/sources/SourceItem";
import type { Source } from "../../src/shared/ipc/types";

// 142: nút trên thẻ nguồn là ICON (không chữ) — tên gọi qua aria-label (kèm tên nguồn) + tooltip; không đè tên/trạng thái.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const src = (over: Partial<Source> = {}): Source => ({
  id: "s1",
  notebookId: "nb1",
  kind: "pdf",
  title: "bao-cao.pdf",
  status: "ready",
  errorCode: null,
  pageCount: 3,
  createdAt: 1,
  updatedAt: 1,
  extractionVersion: 1,
  ...over,
});

beforeEach(() => {
  (window as unknown as { api: unknown }).api = {
    sourceReprocess: vi.fn(),
    sourceReprocessCancel: vi.fn(),
    sourceRelink: vi.fn(),
    onSourceProgress: vi.fn(() => () => {}),
  };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (s: Source) =>
  act(() =>
    root.render(
      createElement(
        "ul",
        null,
        createElement(SourceItem, {
          source: s,
          onRetry: vi.fn(),
          onDelete: vi.fn(),
          onOpen: vi.fn(),
        }),
      ),
    ),
  );
const q = (id: string) =>
  container.querySelector(`[data-testid=${id}]`) as HTMLButtonElement | null;

function expectIconButton(
  b: HTMLButtonElement | null,
  label: RegExp,
  tooltip: string,
) {
  expect(b).not.toBeNull();
  expect(b!.textContent?.trim()).toBe(""); // không chữ hiển thị
  expect(b!.querySelector("svg")).not.toBeNull();
  expect(b!.getAttribute("aria-label")).toMatch(label);
  expect(b!.getAttribute("title")).toBe(tooltip);
  expect(b!.classList.contains("src-act")).toBe(true);
}

describe("SourceItem — nút icon (142)", () => {
  it("nguồn sẵn sàng (PDF cũ): Xử lý lại + Xoá là icon, aria-label nêu tên nguồn", () => {
    render(src());
    expectIconButton(
      q("source-reprocess"),
      /Xử lý lại bao-cao\.pdf/,
      "Xử lý lại",
    );
    expectIconButton(q("source-delete"), /Xoá bao-cao\.pdf/, "Xoá");
    expect(q("source-delete")!.classList.contains("danger")).toBe(true);
  });

  it("nguồn lỗi: Thử lại là icon có tên nguồn", () => {
    render(src({ status: "error", errorCode: "extract", kind: "md" }));
    expectIconButton(q("source-retry"), /Thử lại bao-cao\.pdf/, "Thử lại");
  });
});
