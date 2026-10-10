// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { useStudio } from "../../src/renderer/features/studio/useStudio";
import type {
  StudioGenerateInput,
  StudioProgressEvent,
} from "@shared/ipc/types";

// 146 (T014): useStudio — mỗi generate gửi generationId mới; sự kiện đúng id ⇒ progress[kind]; lượt cũ bị bỏ; xong/lỗi/đổi
// notebook ⇒ xoá; hai loại song song độc lập; (analyze L2) "Tạo bằng AI cục bộ" cũng có id mới + tiến độ riêng.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let hook: ReturnType<typeof useStudio>;
let push: (e: StudioProgressEvent) => void;
let inputs: StudioGenerateInput[];
let settle: Array<{ ok: (v: unknown) => void; fail: (e: unknown) => void }>;

function Harness({ nb }: { nb: string }): null {
  hook = useStudio(nb);
  return null;
}

beforeEach(() => {
  inputs = [];
  settle = [];
  (window as unknown as { api: unknown }).api = {
    aiGetRuntimeStatus: () => Promise.resolve({ ollamaReady: true }),
    sourceListByNotebook: () => Promise.resolve([]),
    onSourceProgress: () => () => undefined,
    onStudioStreamToken: () => () => undefined, // 178 PR 4
    onStudioProgress: (cb: (e: StudioProgressEvent) => void) => {
      push = cb;
      return () => undefined;
    },
    studioList: () => Promise.resolve([]),
    studioCancel: () => Promise.resolve({ cancelled: true }), // 149
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

const ev = (
  generationId: string,
  over: Partial<StudioProgressEvent> = {},
): StudioProgressEvent => ({
  generationId,
  notebookId: "A",
  kind: "summary",
  phase: "reading",
  index: 1,
  total: 3,
  ...over,
});

async function mount(nb = "A"): Promise<void> {
  await act(async () => root.render(createElement(Harness, { nb })));
}

describe("useStudio — tiến độ (146)", () => {
  it("mỗi lần tạo gửi generationId mới, hợp lệ", async () => {
    await mount();
    act(() => void hook.generate("summary"));
    await act(async () =>
      settle[0].ok({ kind: "summary", content: "x", citations: [] }),
    );
    act(() => void hook.generate("summary"));
    expect(inputs).toHaveLength(2);
    expect(inputs[0].generationId).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(inputs[1].generationId).not.toBe(inputs[0].generationId);
  });

  it("sự kiện đúng id ⇒ progress[kind]; xong ⇒ xoá", async () => {
    await mount();
    act(() => void hook.generate("summary"));
    const id = inputs[0].generationId!;
    act(() => push(ev(id, { index: 2 })));
    expect(hook.progress.summary).toEqual({
      generationId: id,
      phase: "reading",
      index: 2,
      total: 3,
    });
    await act(async () =>
      settle[0].ok({ kind: "summary", content: "x", citations: [] }),
    );
    expect(hook.progress.summary).toBeUndefined();
  });

  it("lỗi ⇒ xoá tiến độ", async () => {
    await mount();
    act(() => void hook.generate("summary"));
    act(() => push(ev(inputs[0].generationId!)));
    await act(async () => settle[0].fail(new Error("x")));
    expect(hook.progress.summary).toBeUndefined();
  });

  it("tạo lại: sự kiện của lượt cũ bị bỏ", async () => {
    await mount();
    act(() => void hook.generate("summary"));
    const old = inputs[0].generationId!;
    await act(async () =>
      settle[0].ok({ kind: "summary", content: "x", citations: [] }),
    );
    act(() => void hook.generate("summary"));
    const cur = inputs[1].generationId!;
    act(() =>
      push(ev(old, { phase: "writing", index: undefined, total: undefined })),
    );
    expect(hook.progress.summary).toBeUndefined();
    act(() => push(ev(cur)));
    expect(hook.progress.summary?.generationId).toBe(cur);
  });

  it("đổi notebook ⇒ xoá tiến độ, sự kiện của notebook cũ bị bỏ", async () => {
    await mount("A");
    act(() => void hook.generate("summary"));
    const id = inputs[0].generationId!;
    act(() => push(ev(id)));
    await mount("B");
    expect(hook.progress.summary).toBeUndefined();
    act(() => push(ev(id, { index: 2 })));
    expect(hook.progress.summary).toBeUndefined();
  });

  it("hai loại song song độc lập", async () => {
    await mount();
    act(() => void hook.generate("summary"));
    act(() => void hook.generate("faq"));
    const [s, f] = inputs.map((i) => i.generationId!);
    act(() => push(ev(s, { index: 2 })));
    act(() =>
      push(
        ev(f, {
          kind: "faq",
          phase: "writing",
          index: undefined,
          total: undefined,
        }),
      ),
    );
    expect(hook.progress.summary?.index).toBe(2);
    expect(hook.progress.faq?.phase).toBe("writing");
    await act(async () =>
      settle[1].ok({ kind: "faq", content: "x", citations: [] }),
    );
    expect(hook.progress.faq).toBeUndefined();
    expect(hook.progress.summary?.index).toBe(2);
  });

  it("(L2) Tạo bằng AI cục bộ: id mới + tiến độ riêng; sự kiện của lượt online lỗi trước đó bị bỏ", async () => {
    await mount();
    act(() => void hook.generate("summary"));
    const online = inputs[0].generationId!;
    await act(async () => settle[0].fail(new Error("online lỗi")));
    act(() => void hook.generate("summary", { target: "local" }));
    expect(inputs[1].target).toBe("local");
    const local = inputs[1].generationId!;
    expect(local).not.toBe(online);
    act(() => push(ev(online, { index: 3 })));
    expect(hook.progress.summary).toBeUndefined();
    act(() =>
      push(ev(local, { phase: "writing", index: undefined, total: undefined })),
    );
    expect(hook.progress.summary).toEqual({
      generationId: local,
      phase: "writing",
    });
  });
});
