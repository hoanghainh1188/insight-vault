// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { SettingsRerankerStatus } from "../../src/renderer/features/ai-runtime/SettingsRerankerStatus";
import type { RerankerStatus } from "../../src/shared/ipc/types";

// 109 (FR-016, T034): Cài đặt › AI — một dòng trạng thái bộ chấm độ liên quan (vi/en); unavailable ⇒ ẩn; đang tải ⇒ làm mới.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let getRerankerStatus: ReturnType<typeof vi.fn>;

function install(...seq: RerankerStatus[]) {
  getRerankerStatus = vi.fn();
  for (const s of seq) getRerankerStatus.mockResolvedValueOnce(s);
  getRerankerStatus.mockResolvedValue(seq[seq.length - 1]);
  (window as unknown as { api: unknown }).api = { getRerankerStatus };
}

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

const render = async () => {
  act(() => root.render(createElement(SettingsRerankerStatus)));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
};
const line = () =>
  container.querySelector(
    "[data-testid=reranker-status]",
  ) as HTMLElement | null;

describe("SettingsRerankerStatus", () => {
  it("unavailable ⇒ không hiện gì", async () => {
    install("unavailable");
    await render();
    expect(line()).toBeNull();
  });

  it("ready ⇒ hiện tiêu đề + trạng thái (tiếng Việt mặc định)", async () => {
    install("ready");
    await render();
    expect(line()?.textContent).toContain("Bộ chấm độ liên quan");
    expect(line()?.textContent).toContain("Sẵn sàng");
    expect(line()?.getAttribute("data-state")).toBe("ready");
  });

  it("downloading ⇒ làm mới định kỳ tới khi ready", async () => {
    install("downloading", "downloading", "ready");
    await render();
    expect(line()?.getAttribute("data-state")).toBe("downloading");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(line()?.getAttribute("data-state")).toBe("ready");
    const calls = getRerankerStatus.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(getRerankerStatus.mock.calls.length).toBe(calls); // ready ⇒ ngừng làm mới
  });

  it("error ⇒ vẫn làm mới thưa (30 s) để thấy khi main thử lại thành công", async () => {
    install("error", "ready");
    await render();
    expect(line()?.getAttribute("data-state")).toBe("error");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(line()?.getAttribute("data-state")).toBe("error");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(line()?.getAttribute("data-state")).toBe("ready");
  });

  it("IPC lỗi ⇒ ẩn, không crash", async () => {
    getRerankerStatus = vi.fn().mockRejectedValue(new Error("x"));
    (window as unknown as { api: unknown }).api = { getRerankerStatus };
    await render();
    expect(line()).toBeNull();
  });
});
