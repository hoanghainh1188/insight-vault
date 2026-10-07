// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { StudioResultCard } from "../../src/renderer/features/studio/StudioResultCard";
import type { StudioResult } from "../../src/shared/ipc/types";

// 105 — card Studio nói rõ khi kết quả tổng hợp từ nhiều phần (chip vẫn trỏ đúng đoạn) / còn phần chưa tổng hợp.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => act(() => root.unmount()));

const result = (over: Partial<StudioResult>): StudioResult => ({
  id: "r1",
  notebookId: "nb1",
  kind: "summary",
  content: "Nội dung [1].",
  citations: [],
  createdAt: 1,
  ...over,
});

const render = (r: StudioResult): void =>
  act(() =>
    root.render(
      createElement(StudioResultCard, {
        result: r,
        regenerating: false,
        onRegenerate: () => undefined,
      }),
    ),
  );

describe("StudioResultCard — số phần", () => {
  it("nhiều phần ⇒ ghi 'Tổng hợp từ N phần' + chip vẫn trỏ đúng đoạn", () => {
    render(result({ parts: 4 }));
    const note = container.querySelector("[data-testid=studio-parts]")!;
    expect(note.textContent).toContain("Tổng hợp từ 4 phần");
    expect(note.textContent).toContain("đúng đoạn");
  });

  it("1 phần / không rõ ⇒ không ghi chú số phần", () => {
    render(result({ parts: 1 }));
    expect(container.querySelector("[data-testid=studio-parts]")).toBeNull();
    render(result({}));
    expect(container.querySelector("[data-testid=studio-parts]")).toBeNull();
  });

  it("còn phần chưa tổng hợp ⇒ gợi ý lọc theo từng nguồn", () => {
    render(result({ parts: 12, truncated: true }));
    expect(
      container.querySelector("[data-testid=studio-truncated]")!.textContent,
    ).toMatch(/lọc theo từng nguồn/);
  });
});
