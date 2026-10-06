// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { ErrorBoundary } from "../../src/renderer/shared/ErrorBoundary";
import {
  errorTypeOf,
  installGlobalErrorReporting,
} from "../../src/renderer/shared/error-report";

// 088 — error boundary: 1 component ném lỗi ⇒ giao diện lỗi tiếng Việt (role=alert) thay vì trắng trang, báo về
// main CHỈ loại lỗi + componentStack (không message), Thử lại / đổi resetKey ⇒ dựng lại, mở thư mục nhật ký.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let shouldThrow = true;
// jsdom/vitest coi mọi sự kiện "error" chưa preventDefault là lỗi chưa xử lý (React dev cũng phát lại lỗi
// của boundary lên window) ⇒ chặn mặc định trong suốt test để đầu ra sạch; listener của app vẫn nhận sự kiện.
const swallow = (e: Event): void => e.preventDefault();
const reportRendererError = vi.fn(() => Promise.resolve({ ok: true }));
const openLogsFolder = vi.fn(() => Promise.resolve({ ok: true }));

function Bomb(): JSX.Element {
  if (shouldThrow) throw new TypeError("nội dung tài liệu mật");
  return createElement("p", { "data-testid": "ok" }, "Bình thường");
}

function render(node: ReactNode): void {
  act(() => root.render(node));
}

const byText = (t: string): HTMLElement | undefined =>
  Array.from(container.querySelectorAll<HTMLElement>("button")).find(
    (b) => b.textContent === t,
  );

beforeEach(() => {
  shouldThrow = true;
  reportRendererError.mockClear();
  openLogsFolder.mockClear();
  (window as unknown as { api: unknown }).api = {
    reportRendererError,
    openLogsFolder,
  };
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  window.addEventListener("error", swallow);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.removeEventListener("error", swallow);
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("không lỗi ⇒ hiển thị con bình thường", () => {
    shouldThrow = false;
    render(createElement(ErrorBoundary, null, createElement(Bomb)));
    expect(container.querySelector("[data-testid=ok]")).not.toBeNull();
    expect(container.querySelector("[role=alert]")).toBeNull();
  });

  it("con ném lỗi ⇒ giao diện lỗi + báo loại lỗi, KHÔNG gửi message", () => {
    render(createElement(ErrorBoundary, null, createElement(Bomb)));
    const alert = container.querySelector("[role=alert]");
    expect(alert?.textContent).toContain("Đã xảy ra lỗi");
    expect(alert?.textContent).not.toContain("tài liệu mật");
    expect(reportRendererError).toHaveBeenCalledTimes(1);
    const arg = (reportRendererError.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >;
    expect(arg.source).toBe("boundary");
    expect(arg.errorType).toBe("TypeError");
    expect(typeof arg.componentStack).toBe("string");
    expect(JSON.stringify(arg)).not.toContain("tài liệu mật");
  });

  it("Thử lại ⇒ dựng lại con", () => {
    render(createElement(ErrorBoundary, null, createElement(Bomb)));
    shouldThrow = false;
    act(() => byText("Thử lại")!.click());
    expect(container.querySelector("[data-testid=ok]")).not.toBeNull();
  });

  it("đổi resetKey (điều hướng) ⇒ tự hồi phục", () => {
    render(
      createElement(ErrorBoundary, {
        resetKey: "/a",
        children: createElement(Bomb),
      }),
    );
    expect(container.querySelector("[role=alert]")).not.toBeNull();
    shouldThrow = false;
    render(
      createElement(ErrorBoundary, {
        resetKey: "/b",
        children: createElement(Bomb),
      }),
    );
    expect(container.querySelector("[data-testid=ok]")).not.toBeNull();
  });

  it("Mở thư mục nhật ký ⇒ gọi kênh; thất bại ⇒ báo cho người dùng", async () => {
    openLogsFolder.mockImplementationOnce(() => Promise.resolve({ ok: false }));
    render(createElement(ErrorBoundary, null, createElement(Bomb)));
    await act(async () => byText("Mở thư mục nhật ký")!.click());
    expect(openLogsFolder).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Không mở được thư mục nhật ký");
  });
});

describe("ErrorBoundary khi preload hỏng", () => {
  it("window.api không có ⇒ vẫn hiện giao diện lỗi, không trắng trang", () => {
    (window as unknown as { api: unknown }).api = undefined;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    render(createElement(ErrorBoundary, null, createElement(Bomb)));
    expect(container.querySelector("[role=alert]")).not.toBeNull();
  });
});

describe("error-report", () => {
  it("ErrorEvent không kèm error (ResizeObserver loop…) ⇒ bỏ qua", () => {
    const uninstall = installGlobalErrorReporting(window);
    window.dispatchEvent(
      new ErrorEvent("error", {
        message:
          "ResizeObserver loop completed with undelivered notifications.",
        cancelable: true,
      }),
    );
    uninstall();
    expect(reportRendererError).not.toHaveBeenCalled();
  });

  it("errorTypeOf: lấy name của Error, kiểu nguyên thuỷ với giá trị khác", () => {
    expect(errorTypeOf(new RangeError("x"))).toBe("RangeError");
    expect(errorTypeOf("chuỗi")).toBe("string");
    expect(errorTypeOf(undefined)).toBe("undefined");
  });

  it("lỗi toàn cục (window error + unhandledrejection) được báo về main", () => {
    const uninstall = installGlobalErrorReporting(window);
    window.dispatchEvent(
      new ErrorEvent("error", {
        error: new SyntaxError("bí mật"),
        cancelable: true,
      }),
    );
    const rej = new Event("unhandledrejection") as Event & { reason: unknown };
    rej.reason = new DOMException("x", "AbortError");
    window.dispatchEvent(rej);
    uninstall();
    window.dispatchEvent(
      new ErrorEvent("error", { error: new Error("sau"), cancelable: true }),
    );
    expect(
      reportRendererError.mock.calls.map((c) => (c as unknown[])[0]),
    ).toEqual([
      { source: "window", errorType: "SyntaxError" },
      { source: "rejection", errorType: "AbortError" },
    ]);
  });
});
