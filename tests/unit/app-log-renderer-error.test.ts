import { describe, it, expect, vi } from "vitest";
import {
  createRendererErrorReporter,
  sanitizeRendererError,
} from "../../src/main/services/app-log/renderer-error";

// 088 — lỗi renderer báo về main: CHỈ giữ loại lỗi + tên component (Constitution III — không message/stack
// thô, không đường dẫn). Đầu vào từ renderer là dữ liệu không tin cậy ⇒ kiểm & làm sạch ở main.

const REACT_STACK = `
    at Workspace (http://localhost:5173/src/renderer/features/sources/Workspace.tsx?t=1:20:3)
    at div
    at ErrorBoundary (http://localhost:5173/src/renderer/shared/ErrorBoundary.tsx:12:5)
    at main
    at App (file:///Users/tenriengtu/app/out/renderer/assets/index.js:1:2)`;

describe("sanitizeRendererError", () => {
  it("giữ nguồn + loại lỗi + tên component, bỏ thẻ HTML và URL/đường dẫn", () => {
    expect(
      sanitizeRendererError({
        source: "boundary",
        errorType: "TypeError",
        componentStack: REACT_STACK,
      }),
    ).toEqual({
      source: "boundary",
      errorType: "TypeError",
      components: ["Workspace", "ErrorBoundary", "App"],
    });
  });

  it("định dạng cũ 'in Foo (created by Bar)' cũng tách được tên", () => {
    const r = sanitizeRendererError({
      source: "boundary",
      errorType: "Error",
      componentStack:
        "\n    in NotebookCard (created by NotebooksGrid)\n    in NotebooksGrid",
    });
    expect(r?.components).toEqual(["NotebookCard", "NotebooksGrid"]);
  });

  it("loại lỗi lạ (có khoảng trắng/nội dung) ⇒ 'Unknown'", () => {
    const r = sanitizeRendererError({
      source: "window",
      errorType: "không đọc được tài liệu mật.pdf",
    });
    expect(r?.errorType).toBe("Unknown");
    expect(r?.components).toEqual([]);
  });

  it("giới hạn số component", () => {
    const stack = Array.from({ length: 30 }, (_, i) => `    at C${i} (x)`).join(
      "\n",
    );
    const r = sanitizeRendererError({
      source: "boundary",
      errorType: "Error",
      componentStack: stack,
    });
    expect(r?.components).toHaveLength(8);
  });

  it("đầu vào sai hình ⇒ null", () => {
    expect(sanitizeRendererError(null)).toBeNull();
    expect(sanitizeRendererError("TypeError")).toBeNull();
    expect(
      sanitizeRendererError({ source: "fs", errorType: "Error" }),
    ).toBeNull();
    expect(
      sanitizeRendererError({ source: "boundary", errorType: 42 }),
    ).toEqual({ source: "boundary", errorType: "Unknown", components: [] });
  });

  it("componentStack quá dài bị cắt trước khi phân tích (không treo)", () => {
    const r = sanitizeRendererError({
      source: "boundary",
      errorType: "Error",
      componentStack: "    at Big (x)\n" + "a".repeat(1_000_000),
    });
    expect(r?.components).toEqual(["Big"]);
  });
});

describe("createRendererErrorReporter", () => {
  it("ghi qua log với sự kiện renderer.error", () => {
    const log = vi.fn();
    const report = createRendererErrorReporter({ log, max: 5 });
    expect(report({ source: "rejection", errorType: "AbortError" })).toEqual({
      ok: true,
    });
    expect(log).toHaveBeenCalledWith("renderer.error", {
      source: "rejection",
      errorType: "AbortError",
      components: [],
    });
  });

  it("đầu vào không hợp lệ ⇒ ok:false, không ghi", () => {
    const log = vi.fn();
    const report = createRendererErrorReporter({ log, max: 5 });
    expect(report({ nope: true })).toEqual({ ok: false });
    expect(log).not.toHaveBeenCalled();
  });

  it("cùng 1 lỗi lặp lại chỉ ghi tối đa 3 lần — không chiếm hết hạn mức của lỗi khác", () => {
    const log = vi.fn();
    const report = createRendererErrorReporter({ log, max: 50 });
    for (let i = 0; i < 20; i++)
      report({ source: "window", errorType: "Error" });
    report({ source: "window", errorType: "TypeError" });
    const events = log.mock.calls.map((c) => c[1]?.errorType);
    expect(events.filter((e) => e === "Error")).toHaveLength(3);
    expect(events).toContain("TypeError");
  });

  it("chặn lũ báo lỗi: quá max ⇒ ghi 1 dòng 'đã chặn' rồi im", () => {
    const log = vi.fn();
    const report = createRendererErrorReporter({ log, max: 2 });
    for (let i = 0; i < 10; i++)
      report({ source: "window", errorType: `E${i}` });
    expect(log).toHaveBeenCalledTimes(3);
    expect(log).toHaveBeenLastCalledWith("renderer.error.suppressed", {
      max: 2,
    });
  });
});
