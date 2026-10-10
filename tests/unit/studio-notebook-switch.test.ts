// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { useStudio } from "../../src/renderer/features/studio/useStudio";

// 091 (review S3) — Studio đang tạo mà người dùng chuyển notebook: kết quả về muộn KHÔNG được ghi vào notebook
// mới và generate trả "stale" (149; trước là false — để UI không báo "Đã tạo xong" sai cho trình đọc màn hình).

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let hook: ReturnType<typeof useStudio>;
let resolveGen: (v: unknown) => void;

function Harness({ nb }: { nb: string }): null {
  hook = useStudio(nb);
  return null;
}

beforeEach(() => {
  (window as unknown as { api: unknown }).api = {
    aiGetRuntimeStatus: () => Promise.resolve({ ollamaReady: true }),
    sourceListByNotebook: () => Promise.resolve([]),
    onSourceProgress: () => () => undefined,
    onStudioStreamToken: () => () => undefined, // 178 PR 4
    onStudioProgress: () => () => undefined, // 146
    studioCancel: () => Promise.resolve({ cancelled: true }), // 149
    studioList: () => Promise.resolve([]),
    studioGenerate: vi.fn(() => new Promise((r) => (resolveGen = r))),
  };
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => act(() => root.unmount()));

describe("useStudio — chuyển notebook giữa lúc tạo", () => {
  it("kết quả về muộn bị bỏ, generate trả 'stale', không kẹt trạng thái đang tạo", async () => {
    await act(async () => root.render(createElement(Harness, { nb: "A" })));
    let done: Promise<string> = Promise.resolve("done");
    act(() => {
      done = hook.generate("summary");
    });
    expect(hook.loading.summary).toBe(true);
    await act(async () => root.render(createElement(Harness, { nb: "B" })));
    expect(hook.loading.summary).toBeFalsy();
    await act(async () => {
      resolveGen({ kind: "summary", content: "của A", citations: [] });
    });
    expect(await done).toBe("stale"); // 149: kết cục thay boolean (false ⇒ "stale")
    expect(hook.results.summary).toBeUndefined();
    expect(hook.loading.summary).toBeFalsy();
  });

  it("cùng notebook ⇒ ghi kết quả, trả 'done'", async () => {
    await act(async () => root.render(createElement(Harness, { nb: "A" })));
    let done: Promise<string> = Promise.resolve("stale");
    act(() => {
      done = hook.generate("summary");
    });
    await act(async () => {
      resolveGen({ kind: "summary", content: "ok", citations: [] });
    });
    expect(await done).toBe("done"); // 149: true ⇒ "done"
    expect(hook.results.summary).toBeDefined();
  });
});
