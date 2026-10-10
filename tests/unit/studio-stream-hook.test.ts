// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { useStudio } from "../../src/renderer/features/studio/useStudio";
import { encodeUserError } from "@shared/codes/user-error";
import type {
  StudioGenerateInput,
  StudioResult,
  StudioStreamTokenEvent,
} from "@shared/ipc/types";

// 178 (PR 4, T066, FR-042/FR-043, research R8): useStudio — đăng ký onStudioStreamToken MỘT lần; chỉ nhận token của lượt HIỆN
// HÀNH (isCurrentGeneration); nối streamText[kind]; xong / lỗi / huỷ / đổi notebook ⇒ xoá; token của lượt bị thay bị bỏ.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let hook: ReturnType<typeof useStudio>;
let push: (e: StudioStreamTokenEvent) => void;
let subscribed: number;
let unsubscribed: number;
let inputs: StudioGenerateInput[];
let settle: Array<{ ok: (v: unknown) => void; fail: (e: unknown) => void }>;

function Harness({ nb }: { nb: string }): null {
  hook = useStudio(nb);
  return null;
}

beforeEach(() => {
  inputs = [];
  settle = [];
  subscribed = 0;
  unsubscribed = 0;
  (window as unknown as { api: unknown }).api = {
    aiGetRuntimeStatus: () => Promise.resolve({ ollamaReady: true }),
    sourceListByNotebook: () => Promise.resolve([]),
    onSourceProgress: () => () => undefined,
    onStudioProgress: () => () => undefined,
    onStudioStreamToken: (cb: (e: StudioStreamTokenEvent) => void) => {
      subscribed += 1;
      push = cb;
      return () => {
        unsubscribed += 1;
      };
    },
    studioList: () => Promise.resolve([]),
    studioCancel: () => Promise.resolve({ cancelled: true }),
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

const tok = (generationId: string, delta: string): void =>
  act(() => push({ generationId, delta }));

const result = (kind: StudioResult["kind"] = "summary"): StudioResult => ({
  id: "r1",
  notebookId: "A",
  kind,
  content: "Kết quả [1].",
  citations: [],
  createdAt: 1,
});

describe("useStudio — stream (178 PR 4)", () => {
  it("đăng ký onStudioStreamToken một lần (qua nhiều lần render / đổi notebook)", async () => {
    await mount("A");
    await mount("A");
    await mount("B");
    expect(subscribed).toBe(1);
    act(() => root.unmount());
    root = createRoot(container);
    expect(unsubscribed).toBe(1);
  });

  it("token của lượt hiện hành ⇒ nối streamText[kind] theo thứ tự", async () => {
    await mount();
    act(() => void hook.generate("summary"));
    const id = inputs[0].generationId!;
    expect(hook.streamText.summary).toBeUndefined();
    tok(id, "Xin ");
    tok(id, "chào [1");
    expect(hook.streamText.summary).toBe("Xin chào [1");
  });

  it("token có id lạ ⇒ bỏ", async () => {
    await mount();
    act(() => void hook.generate("summary"));
    tok("id-la", "rác");
    expect(hook.streamText.summary).toBeUndefined();
  });

  it("xong ⇒ xoá streamText (thay bằng phiên bản hậu kiểm)", async () => {
    await mount();
    act(() => void hook.generate("summary"));
    tok(inputs[0].generationId!, "abc");
    await act(async () => settle[0].ok(result()));
    expect(hook.streamText.summary).toBeUndefined();
    expect(hook.results.summary?.id).toBe("r1");
  });

  it("lỗi ⇒ xoá streamText", async () => {
    await mount();
    act(() => void hook.generate("summary"));
    tok(inputs[0].generationId!, "abc");
    await act(async () =>
      settle[0].fail(new Error(encodeUserError("studioEmptyOutput"))),
    );
    expect(hook.streamText.summary).toBeUndefined();
    expect(hook.errors.summary).toBeDefined();
  });

  it("huỷ ⇒ bỏ hết chữ tạm; token tới muộn sau huỷ bị bỏ", async () => {
    await mount();
    act(() => void hook.generate("summary"));
    const id = inputs[0].generationId!;
    tok(id, "abc");
    act(() => hook.cancel("summary"));
    await act(async () =>
      settle[0].fail(new Error(encodeUserError("studioCancelled"))),
    );
    expect(hook.streamText.summary).toBeUndefined();
    tok(id, "muộn");
    expect(hook.streamText.summary).toBeUndefined();
  });

  it("Tạo lại khi đang chạy ⇒ token của lượt bị thay bị bỏ, chữ tạm bắt đầu lại", async () => {
    await mount();
    act(() => void hook.generate("summary"));
    const first = inputs[0].generationId!;
    tok(first, "cũ");
    act(() => void hook.generate("summary"));
    const second = inputs[1].generationId!;
    expect(hook.streamText.summary).toBeUndefined();
    tok(first, "rác");
    tok(second, "mới");
    expect(hook.streamText.summary).toBe("mới");
  });

  it("đổi notebook ⇒ xoá streamText; token của lượt notebook cũ bị bỏ", async () => {
    await mount("A");
    act(() => void hook.generate("summary"));
    const id = inputs[0].generationId!;
    tok(id, "abc");
    await mount("B");
    expect(hook.streamText.summary).toBeUndefined();
    tok(id, "muộn");
    expect(hook.streamText.summary).toBeUndefined();
  });

  it("hai loại song song độc lập", async () => {
    await mount();
    act(() => void hook.generate("summary"));
    act(() => void hook.generate("faq"));
    tok(inputs[0].generationId!, "S");
    tok(inputs[1].generationId!, "F");
    expect(hook.streamText).toEqual({ summary: "S", faq: "F" });
  });
});
