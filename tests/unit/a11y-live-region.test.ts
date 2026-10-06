// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { LiveRegion } from "../../src/renderer/shared/a11y/LiveRegion";
import { announce } from "../../src/renderer/shared/a11y/announcer";
import { SourceItem } from "../../src/renderer/features/sources/SourceItem";
import type { Source } from "../../src/shared/ipc/types";

// 091 — vùng thông báo ẩn: polite/assertive tách riêng; xoá rồi đặt lại để trình đọc màn hình đọc lại cả khi
// câu lặp y hệt. Thanh tiến độ nguồn tra được bằng role=progressbar thay vì aria-hidden.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const polite = (): HTMLElement =>
  container.querySelector("[data-testid=live-polite]")!;
const assertive = (): HTMLElement =>
  container.querySelector("[data-testid=live-assertive]")!;

describe("LiveRegion", () => {
  it("2 vùng ẩn với aria-live đúng mức", () => {
    act(() => root.render(createElement(LiveRegion)));
    expect(polite().getAttribute("aria-live")).toBe("polite");
    expect(assertive().getAttribute("aria-live")).toBe("assertive");
    expect(polite().getAttribute("aria-atomic")).toBe("true");
    expect(polite().className).toContain("sr-only");
  });

  it("thông báo polite/assertive vào đúng vùng", () => {
    act(() => root.render(createElement(LiveRegion)));
    act(() => {
      announce("Nguồn đã sẵn sàng.");
      announce("Lỗi nghiêm trọng.", "assertive");
    });
    act(() => void vi.advanceTimersByTime(100));
    expect(polite().textContent).toBe("Nguồn đã sẵn sàng.");
    expect(assertive().textContent).toBe("Lỗi nghiêm trọng.");
  });

  it("câu lặp y hệt: xoá trước rồi đặt lại (để được đọc lần nữa)", () => {
    act(() => root.render(createElement(LiveRegion)));
    act(() => announce("Đã có câu trả lời."));
    act(() => void vi.advanceTimersByTime(1000));
    act(() => announce("Đã có câu trả lời."));
    expect(polite().textContent).toBe("");
    act(() => void vi.advanceTimersByTime(100));
    expect(polite().textContent).toBe("Đã có câu trả lời.");
  });
});

describe("LiveRegion — hàng đợi", () => {
  it("2 câu cùng mức tới sát nhau ⇒ đọc lần lượt, không nuốt câu đầu", () => {
    act(() => root.render(createElement(LiveRegion)));
    act(() => {
      announce("Nguồn “a.pdf” đã sẵn sàng.");
      announce("Nguồn “b.pdf” đã sẵn sàng.");
    });
    act(() => void vi.advanceTimersByTime(60));
    expect(polite().textContent).toBe("Nguồn “a.pdf” đã sẵn sàng.");
    act(() => void vi.advanceTimersByTime(600));
    expect(polite().textContent).toBe("Nguồn “b.pdf” đã sẵn sàng.");
  });

  it("xoá câu cuối sau vài giây (không bị đọc lại khi duyệt trang)", () => {
    act(() => root.render(createElement(LiveRegion)));
    act(() => announce("Đã có câu trả lời."));
    act(() => void vi.advanceTimersByTime(1000));
    expect(polite().textContent).toBe("Đã có câu trả lời.");
    act(() => void vi.advanceTimersByTime(10_000));
    expect(polite().textContent).toBe("");
  });

  it("polite và assertive chạy độc lập", () => {
    act(() => root.render(createElement(LiveRegion)));
    act(() => {
      announce("Một.");
      announce("Lỗi.", "assertive");
    });
    act(() => void vi.advanceTimersByTime(60));
    expect(polite().textContent).toBe("Một.");
    expect(assertive().textContent).toBe("Lỗi.");
  });
});

describe("SourceItem — thanh tiến độ tra được", () => {
  const src: Source = {
    id: "s1",
    notebookId: "n1",
    kind: "pdf",
    title: "hop-dong.pdf",
    status: "processing",
  } as Source;

  it("role=progressbar với giá trị + nhãn", () => {
    act(() =>
      root.render(
        createElement(
          "ul",
          null,
          createElement(SourceItem, {
            source: src,
            progress: { step: "embed", progress: 0.4 },
            onRetry: () => undefined,
            onDelete: () => undefined,
          }),
        ),
      ),
    );
    const bar = container.querySelector("[role=progressbar]")!;
    expect(bar).not.toBeNull();
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(bar.getAttribute("aria-valuetext")).toBe("Nhúng, 40%");
    expect(bar.getAttribute("aria-label")).toBe("Tiến độ xử lý hop-dong.pdf");
    expect(bar.getAttribute("aria-hidden")).toBeNull();
  });
});
