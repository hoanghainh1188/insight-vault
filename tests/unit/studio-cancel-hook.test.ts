// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { useStudio } from "../../src/renderer/features/studio/useStudio";
import { encodeUserError } from "@shared/codes/user-error";
import type {
  StudioGenerateInput,
  StudioProgressEvent,
} from "@shared/ipc/types";

// 149 (T013): useStudio — Huỷ (kết cục "cancelled" không phải lỗi), lượt hiện hành theo generationId (race A→B→A), tự huỷ khi đổi
// notebook / unmount, Tạo bằng AI cục bộ, hai loại song song.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let hook: ReturnType<typeof useStudio>;
let push: (e: StudioProgressEvent) => void;
let inputs: StudioGenerateInput[];
let settle: Array<{ ok: (v: unknown) => void; fail: (e: unknown) => void }>;
let studioCancel: ReturnType<typeof vi.fn>;

function Harness({ nb }: { nb: string }): null {
  hook = useStudio(nb);
  return null;
}

const cancelledErr = (): Error => new Error(encodeUserError("studioCancelled"));
const onlineErr = (): Error => new Error("OpenAI: timeout [[online:timeout]]");
const result = (kind: string, content = "x") => ({
  id: "r",
  notebookId: "A",
  kind,
  content,
  citations: [],
  createdAt: 1,
});

beforeEach(() => {
  inputs = [];
  settle = [];
  studioCancel = vi.fn(() => Promise.resolve({ cancelled: true }));
  (window as unknown as { api: unknown }).api = {
    aiGetRuntimeStatus: () => Promise.resolve({ ollamaReady: true }),
    sourceListByNotebook: () => Promise.resolve([]),
    onSourceProgress: () => () => undefined,
    onStudioProgress: (cb: (e: StudioProgressEvent) => void) => {
      push = cb;
      return () => undefined;
    },
    studioList: () => Promise.resolve([]),
    studioCancel,
    studioGenerate: vi.fn(
      (input: StudioGenerateInput) =>
        new Promise((ok, fail) => {
          inputs.push(input);
          settle.push({ ok, fail });
        }),
    ),
  };
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => act(() => root.unmount()));

async function mount(nb = "A"): Promise<void> {
  await act(async () => root.render(createElement(Harness, { nb })));
}

describe("useStudio — huỷ (149)", () => {
  it("cancel(kind) ⇒ studioCancel(id, 'user') + cancelling; kết cục huỷ ⇒ 'cancelled', không lỗi, về nghỉ", async () => {
    await mount();
    let done: Promise<string> = Promise.resolve("");
    act(() => {
      done = hook.generate("summary");
    });
    const id = inputs[0].generationId!;
    act(() =>
      push({
        generationId: id,
        notebookId: "A",
        kind: "summary",
        phase: "reading",
        index: 1,
        total: 3,
      }),
    );
    act(() => hook.cancel("summary"));
    expect(studioCancel).toHaveBeenCalledWith(id, "user");
    expect(hook.cancelling.summary).toBe(true);
    await act(async () => settle[0].fail(cancelledErr()));
    expect(await done).toBe("cancelled");
    expect(hook.errors.summary).toBeUndefined();
    expect(hook.onlineFailed.summary).toBeFalsy();
    expect(hook.loading.summary).toBeFalsy();
    expect(hook.progress.summary).toBeUndefined();
    expect(hook.cancelling.summary).toBeFalsy();
  });

  it("đã bấm Huỷ nhưng lượt vẫn xong (lưu trước khi huỷ tới) ⇒ 'done', có kết quả", async () => {
    await mount();
    let done: Promise<string> = Promise.resolve("");
    act(() => {
      done = hook.generate("summary");
    });
    act(() => hook.cancel("summary"));
    await act(async () => settle[0].ok(result("summary", "mới")));
    expect(await done).toBe("done");
    expect(hook.results.summary?.content).toBe("mới");
    expect(hook.cancelling.summary).toBeFalsy();
  });

  it("Tạo lại rồi huỷ ⇒ kết quả cũ giữ nguyên", async () => {
    await mount();
    act(() => void hook.generate("summary"));
    await act(async () => settle[0].ok(result("summary", "cũ")));
    act(() => void hook.generate("summary"));
    act(() => hook.cancel("summary"));
    await act(async () => settle[1].fail(cancelledErr()));
    expect(hook.results.summary?.content).toBe("cũ");
    expect(hook.errors.summary).toBeUndefined();
  });

  it("A→B→A: kết quả lượt cũ về muộn KHÔNG ghi đè lượt mới (trả 'stale', loading của lượt mới giữ)", async () => {
    await mount("A");
    let first: Promise<string> = Promise.resolve("");
    act(() => {
      first = hook.generate("summary");
    });
    await mount("B");
    await mount("A");
    act(() => void hook.generate("summary"));
    await act(async () => settle[0].ok(result("summary", "của lượt cũ")));
    expect(await first).toBe("stale");
    expect(hook.results.summary).toBeUndefined();
    expect(hook.loading.summary).toBe(true);
    await act(async () => settle[1].ok(result("summary", "của lượt mới")));
    expect(hook.results.summary?.content).toBe("của lượt mới");
    expect(hook.loading.summary).toBeFalsy();
  });

  it("đổi notebook ⇒ studioCancel(id, 'navigate') cho MỌI lượt đang chạy", async () => {
    await mount("A");
    act(() => void hook.generate("summary"));
    act(() => void hook.generate("faq"));
    const ids = inputs.map((i) => i.generationId);
    await mount("B");
    expect(studioCancel.mock.calls).toEqual(
      expect.arrayContaining([
        [ids[0], "navigate"],
        [ids[1], "navigate"],
      ]),
    );
  });

  it("unmount ⇒ studioCancel(id, 'navigate')", async () => {
    await mount("A");
    act(() => void hook.generate("outline"));
    const id = inputs[0].generationId;
    act(() => root.unmount());
    expect(studioCancel).toHaveBeenCalledWith(id, "navigate");
    root = createRoot(container); // afterEach unmount lại vô hại
  });

  it("Tạo bằng AI cục bộ rồi huỷ ⇒ về nghỉ, KHÔNG khôi phục lỗi online cũ", async () => {
    await mount();
    act(() => void hook.generate("summary"));
    await act(async () => settle[0].fail(onlineErr()));
    expect(hook.onlineFailed.summary).toBe(true);
    act(() => void hook.generate("summary", undefined, "local"));
    act(() => hook.cancel("summary"));
    await act(async () => settle[1].fail(cancelledErr()));
    expect(hook.errors.summary).toBeUndefined();
    expect(hook.onlineFailed.summary).toBeFalsy();
  });

  it("hai loại song song: huỷ FAQ không ảnh hưởng Tóm tắt", async () => {
    await mount();
    act(() => void hook.generate("summary"));
    act(() => void hook.generate("faq"));
    act(() => hook.cancel("faq"));
    expect(studioCancel).toHaveBeenCalledTimes(1);
    await act(async () => settle[1].fail(cancelledErr()));
    expect(hook.loading.faq).toBeFalsy();
    expect(hook.loading.summary).toBe(true);
    await act(async () => settle[0].ok(result("summary")));
    expect(hook.results.summary).toBeDefined();
  });
});
