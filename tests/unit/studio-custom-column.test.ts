// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import type { StudioGenerateInput, StudioResult } from "@shared/ipc/types";
import { StudioColumn } from "../../src/renderer/features/studio/StudioColumn";

// 178 (T047, FR-020, FR-024): cột Studio — hàng yêu cầu tuỳ chỉnh dưới lưới; gửi kind "custom" + customPrompt; thẻ kết quả hiện
// yêu cầu dạng VĂN BẢN THƯỜNG (không thực thi HTML); "Tạo lại" dùng yêu cầu của phiên bản đang xem.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let inputs: StudioGenerateInput[];
let settle: Array<(v: unknown) => void>;

const XSS = '<img src=x onerror="window.__pwned=1">';
const ver = (
  id: string,
  createdAt: number,
  customPrompt: string,
): StudioResult => ({
  id,
  notebookId: "nb1",
  kind: "custom",
  content: `Kết quả ${id} [1]`,
  citations: [],
  createdAt,
  customPrompt,
});

async function mount(existing: StudioResult[] = []): Promise<void> {
  (window as unknown as { api: unknown }).api = {
    aiGetRuntimeStatus: () => Promise.resolve({ ollamaReady: true }),
    sourceListByNotebook: () =>
      Promise.resolve([
        { id: "s1", notebookId: "nb1", status: "ready", title: "A" },
      ]),
    onSourceProgress: () => () => undefined,
    onStudioProgress: () => () => undefined,
    studioList: () => Promise.resolve(existing),
    studioCancel: () => Promise.resolve({ cancelled: true }),
    studioDeleteVersion: () => Promise.resolve({ deleted: true }),
    studioGenerate: (i: StudioGenerateInput) =>
      new Promise((ok) => {
        inputs.push(i);
        settle.push(ok);
      }),
  };
  await act(async () =>
    root.render(createElement(StudioColumn, { notebookId: "nb1" })),
  );
  await act(async () => {});
}

const q = <T extends HTMLElement>(sel: string) =>
  container.querySelector(sel) as T | null;

beforeEach(() => {
  inputs = [];
  settle = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("StudioColumn — yêu cầu tuỳ chỉnh (178)", () => {
  it("hàng custom nằm SAU lưới nút; gửi ⇒ kind custom + customPrompt; xong ⇒ thẻ custom", async () => {
    await mount();
    const actions = q(".studio-actions")!;
    const custom = q("[data-testid=studio-custom]")!;
    expect(
      actions.compareDocumentPosition(custom) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    act(() => {
      const ta = q<HTMLTextAreaElement>("[data-testid=studio-custom-input]")!;
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )!.set!.call(ta, "Liệt kê rủi ro");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      q<HTMLButtonElement>("[data-testid=studio-custom-submit]")!.click(),
    );
    expect(inputs[0]).toMatchObject({
      kind: "custom",
      customPrompt: "Liệt kê rủi ro",
    });
    await act(async () => settle[0](ver("c1", 1, "Liệt kê rủi ro")));
    expect(q("[data-testid=studio-card-custom]")).not.toBeNull();
    expect(q("[data-testid=studio-request-custom]")?.textContent).toContain(
      "Liệt kê rủi ro",
    );
  });

  it("yêu cầu chứa HTML hiển thị nguyên văn, không tạo phần tử", async () => {
    await mount([ver("c1", 1, XSS)]);
    const req = q("[data-testid=studio-request-custom]")!;
    expect(req.textContent).toContain(XSS);
    expect(req.querySelector("img")).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it("'Tạo lại' trên thẻ custom dùng yêu cầu của PHIÊN BẢN ĐANG XEM", async () => {
    await mount([ver("c2", 2, "Yêu cầu mới"), ver("c1", 1, "Yêu cầu cũ")]);
    const sel = q<HTMLSelectElement>(
      "[data-testid=studio-version-select-custom]",
    )!;
    act(() => {
      sel.value = "c1";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () =>
      q<HTMLButtonElement>("[data-testid=studio-regen-custom]")!.click(),
    );
    expect(inputs[0]).toMatchObject({
      kind: "custom",
      customPrompt: "Yêu cầu cũ",
    });
  });
});
