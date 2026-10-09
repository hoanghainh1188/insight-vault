// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { SourceItem } from "../../src/renderer/features/sources/SourceItem";
import type { Source, SourceProgressEvent } from "../../src/shared/ipc/types";

// 112 (FR-011..FR-016): cột Nguồn — gợi ý "Xử lý lại để giữ bố cục" (PDF cũ), nút "Xử lý lại" + xác nhận nêu hệ quả,
// tiến độ + Huỷ, tệp mất ⇒ dẫn sang chọn lại tệp gốc, tệp bị sửa ⇒ giải thích, lỗi ⇒ báo (vẫn dùng bản cũ).

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let api: {
  sourceReprocess: ReturnType<typeof vi.fn>;
  sourceReprocessCancel: ReturnType<typeof vi.fn>;
  sourceRelink: ReturnType<typeof vi.fn>;
  onSourceProgress: ReturnType<typeof vi.fn>;
};
let emit: (e: SourceProgressEvent) => void;

const pdf = (over: Partial<Source> = {}): Source => ({
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
  api = {
    sourceReprocess: vi.fn(() => Promise.resolve({ status: "queued" })),
    sourceReprocessCancel: vi.fn(() => Promise.resolve({ cancelled: true })),
    sourceRelink: vi.fn(() => Promise.resolve({ status: "ok" })),
    onSourceProgress: vi.fn((cb: (e: SourceProgressEvent) => void) => {
      emit = cb;
      return () => {};
    }),
  };
  (window as unknown as { api: unknown }).api = api;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const q = (id: string) => container.querySelector(`[data-testid=${id}]`);
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
        }),
      ),
    ),
  );
const click = async (id: string) =>
  act(async () => (q(id) as HTMLButtonElement).click());
const ev = (over: Partial<SourceProgressEvent>): SourceProgressEvent => ({
  sourceId: "s1",
  notebookId: "nb1",
  status: "ready",
  step: "parse",
  progress: 0.2,
  reprocess: true,
  ...over,
});

describe("SourceItem — Xử lý lại (112)", () => {
  it("PDF cũ ⇒ gợi ý thụ động; PDF mới / không phải PDF ⇒ không gợi ý", () => {
    render(pdf());
    expect(q("source-reprocess-hint")?.textContent).toBe(
      "Xử lý lại để giữ bố cục",
    );
    // 147: PDF đã có bố cục (v2) ⇒ câu theo phiên bản; bản hiện hành (v3) ⇒ không gợi ý
    render(pdf({ extractionVersion: 2 }));
    expect(q("source-reprocess-hint")?.textContent).toBe(
      "Xử lý lại để cải thiện bảng, trang xoay và gạch nối",
    );
    expect(q("source-reprocess")?.getAttribute("aria-label")).toContain(
      "cải thiện bảng, trang xoay và gạch nối",
    );
    render(pdf({ extractionVersion: 3 }));
    expect(q("source-reprocess-hint")).toBeNull();
    render(pdf({ kind: "docx" }));
    expect(q("source-reprocess-hint")).toBeNull();
  });

  it("nút chỉ cho PDF ready/error; không cho trạng thái khác hoặc loại khác", () => {
    render(pdf());
    expect(q("source-reprocess")).not.toBeNull();
    render(pdf({ status: "error" }));
    expect(q("source-reprocess")).not.toBeNull();
    render(pdf({ status: "processing" }));
    expect(q("source-reprocess")).toBeNull();
    render(pdf({ kind: "txt" }));
    expect(q("source-reprocess")).toBeNull();
  });

  it("bấm ⇒ hộp xác nhận nêu hệ quả; Huỷ ⇒ không gọi IPC", async () => {
    render(pdf());
    await click("source-reprocess");
    expect(q("source-reprocess-confirm")?.textContent).toMatch(/trích dẫn/);
    expect(q("source-reprocess-confirm")?.getAttribute("role")).toBe(
      "alertdialog",
    );
    await click("source-reprocess-confirm-cancel");
    expect(q("source-reprocess-confirm")).toBeNull();
    expect(api.sourceReprocess).not.toHaveBeenCalled();
  });

  it("đồng ý ⇒ gọi IPC; tiến độ theo sự kiện + nút Huỷ; xong ⇒ hết tiến độ", async () => {
    render(pdf());
    await click("source-reprocess");
    await click("source-reprocess-confirm-ok");
    expect(api.sourceReprocess).toHaveBeenCalledWith("s1");
    act(() => emit(ev({ step: "parse", progress: 0.2 })));
    expect(q("source-reprocess-progress")?.getAttribute("aria-valuenow")).toBe(
      "20",
    );
    expect(q("source-reprocess")).toBeNull(); // không bấm lại khi đang chạy
    await click("source-reprocess-cancel");
    expect(api.sourceReprocessCancel).toHaveBeenCalledWith("s1");
    act(() => emit(ev({ step: "done", progress: 1 })));
    expect(q("source-reprocess-progress")).toBeNull();
    expect(q("source-reprocess-msg")).toBeNull();
  });

  it("sự kiện lỗi ⇒ thông báo, nút xuất hiện lại", async () => {
    render(pdf());
    await click("source-reprocess");
    await click("source-reprocess-confirm-ok");
    act(() =>
      emit(
        ev({
          step: "done",
          progress: 0,
          errorCode: "reprocessFailed",
        }),
      ),
    );
    expect(q("source-reprocess-msg")?.textContent).toBe(
      "Xử lý lại thất bại — vẫn dùng bản cũ.",
    );
    expect(q("source-reprocess")).not.toBeNull();
  });

  it("tệp gốc mất ⇒ mở luồng chọn lại tệp gốc; chọn được ⇒ xử lý lại tiếp", async () => {
    api.sourceReprocess.mockResolvedValueOnce({ status: "missing" });
    render(pdf());
    await click("source-reprocess");
    await click("source-reprocess-confirm-ok");
    expect(api.sourceRelink).toHaveBeenCalledWith("s1");
    expect(api.sourceReprocess).toHaveBeenCalledTimes(2);
  });

  it("tệp gốc đã bị sửa ⇒ giải thích, không chạy", async () => {
    api.sourceReprocess.mockResolvedValueOnce({ status: "mismatch" });
    render(pdf());
    await click("source-reprocess");
    await click("source-reprocess-confirm-ok");
    expect(q("source-reprocess-msg")?.textContent).toMatch(/đã bị sửa/);
    expect(q("source-reprocess-progress")).toBeNull();
  });

  it("IPC ném (vd đang sao lưu) ⇒ hiện thông điệp lỗi theo mã", async () => {
    // 123: main gắn thẻ mã lỗi người-dùng-thấy; renderer dịch theo ngôn ngữ hiện tại.
    api.sourceReprocess.mockRejectedValueOnce(
      new Error("Đang sao lưu/khôi phục [[err:vaultLocked]]"),
    );
    render(pdf());
    await click("source-reprocess");
    await click("source-reprocess-confirm-ok");
    expect(q("source-reprocess-msg")?.textContent).toMatch(/sao lưu/);
  });
});
