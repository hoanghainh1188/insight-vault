// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { readFileSync } from "node:fs";
import { encodeUserError } from "@shared/codes/user-error";
import type {
  StudioGenerateInput,
  StudioProgressEvent,
} from "@shared/ipc/types";
import { StudioCancel } from "../../src/renderer/features/studio/StudioCancel";
import { I18nProvider } from "../../src/renderer/shared/i18n/I18nProvider";

// 149 (T015): nút Huỷ (nhãn / aria có tên loại / "Đang huỷ…"), vị trí trong StudioColumn (trước tiến độ đầu, cạnh dòng pha, trên card
// cũ khi Tạo lại), thông báo huỷ đúng một lần, không khối lỗi, focus sau huỷ; CSS không tràn.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const announced = vi.hoisted(() => [] as string[]);
vi.mock("../../src/renderer/shared/a11y/announcer", () => ({
  announce: (m: string) => announced.push(m),
}));
const { StudioColumn } =
  await import("../../src/renderer/features/studio/StudioColumn");

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  announced.length = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const q = (sel: string) => container.querySelector(sel) as HTMLElement | null;

describe("StudioCancel", () => {
  it("nhãn 'Huỷ', aria-label có tên loại; cancelling ⇒ 'Đang huỷ…' disabled", () => {
    let clicked = 0;
    act(() =>
      root.render(
        createElement(StudioCancel, {
          kind: "summary",
          cancelling: false,
          onCancel: () => (clicked += 1),
        }),
      ),
    );
    const b = q("[data-testid=studio-cancel-summary]") as HTMLButtonElement;
    expect(b.textContent).toBe("Huỷ");
    expect(b.getAttribute("aria-label")).toBe("Huỷ tạo Tóm tắt tài liệu");
    act(() => b.click());
    expect(clicked).toBe(1);
    act(() =>
      root.render(
        createElement(StudioCancel, {
          kind: "summary",
          cancelling: true,
          onCancel: () => undefined,
        }),
      ),
    );
    const b2 = q("[data-testid=studio-cancel-summary]") as HTMLButtonElement;
    expect(b2.textContent).toBe("Đang huỷ…");
    expect(b2.disabled).toBe(true);
  });

  it("English: 'Cancel' + 'Cancel creating Key points'", async () => {
    (window as unknown as { api: unknown }).api = {
      getUiLanguage: () =>
        Promise.resolve({ preference: "en", effective: "en" }),
      onUiLanguageChanged: () => () => undefined,
    };
    act(() =>
      root.render(
        createElement(
          I18nProvider,
          null,
          createElement(StudioCancel, {
            kind: "keyPoints",
            cancelling: false,
            onCancel: () => undefined,
          }),
        ),
      ),
    );
    await act(async () => {});
    const b = q("[data-testid=studio-cancel-keyPoints]")!;
    expect(b.textContent).toBe("Cancel");
    expect(b.getAttribute("aria-label")).toBe("Cancel creating Key points");
  });
});

describe("StudioColumn — Huỷ", () => {
  let push: (e: StudioProgressEvent) => void;
  let inputs: StudioGenerateInput[];
  let settle: Array<{ ok: (v: unknown) => void; fail: (e: unknown) => void }>;
  let studioCancel: ReturnType<typeof vi.fn>;

  async function mount(existing: unknown[] = []): Promise<void> {
    inputs = [];
    settle = [];
    studioCancel = vi.fn(() => Promise.resolve({ cancelled: true }));
    (window as unknown as { api: unknown }).api = {
      aiGetRuntimeStatus: () => Promise.resolve({ ollamaReady: true }),
      sourceListByNotebook: () =>
        Promise.resolve([
          { id: "s1", notebookId: "nb1", status: "ready", title: "A" },
        ]),
      onSourceProgress: () => () => undefined,
      onStudioProgress: (cb: (e: StudioProgressEvent) => void) => {
        push = cb;
        return () => undefined;
      },
      studioList: () => Promise.resolve(existing),
      studioCancel,
      studioGenerate: (i: StudioGenerateInput) =>
        new Promise((ok, fail) => {
          inputs.push(i);
          settle.push({ ok, fail });
        }),
    };
    await act(async () =>
      root.render(createElement(StudioColumn, { notebookId: "nb1" })),
    );
    await act(async () => {});
  }
  const start = (kind = "summary") =>
    act(() =>
      (q(`[data-testid=studio-btn-${kind}]`) as HTMLButtonElement).click(),
    );

  it("nút Huỷ có ngay khi bắt đầu (trước tiến độ đầu) và cạnh dòng pha khi có tiến độ; nút loại giữ 'Đang tạo…'", async () => {
    await mount();
    start();
    expect(q("[data-testid=studio-cancel-summary]")).not.toBeNull();
    expect(q("[data-testid=studio-btn-summary]")!.textContent).toBe(
      "Đang tạo…",
    );
    act(() =>
      push({
        generationId: inputs[0].generationId!,
        notebookId: "nb1",
        kind: "summary",
        phase: "writing",
      }),
    );
    const prog = q("[data-testid=studio-progress-summary]")!;
    expect(
      prog.querySelector("[data-testid=studio-cancel-summary]"),
    ).not.toBeNull();
  });

  it("bấm Huỷ ⇒ studioCancel(id,'user') + 'Đang huỷ…'; kết cục huỷ ⇒ announce đúng 1 lần, không khối lỗi, focus về nút loại", async () => {
    await mount();
    start();
    const btn = q("[data-testid=studio-cancel-summary]") as HTMLButtonElement;
    btn.focus();
    act(() => btn.click());
    expect(studioCancel).toHaveBeenCalledWith(inputs[0].generationId, "user");
    expect(q("[data-testid=studio-cancel-summary]")!.textContent).toBe(
      "Đang huỷ…",
    );
    await act(async () =>
      settle[0].fail(new Error(encodeUserError("studioCancelled"))),
    );
    expect(
      announced.filter((m) => m === "Đã huỷ tạo Tóm tắt tài liệu."),
    ).toHaveLength(1);
    expect(q("[data-testid=studio-error-summary]")).toBeNull();
    expect(q("[data-testid=studio-cancel-summary]")).toBeNull();
    expect(document.activeElement).toBe(q("[data-testid=studio-btn-summary]"));
  });

  it("Tạo lại có card cũ ⇒ nút Huỷ trên card; huỷ ⇒ card cũ còn, focus về 'Tạo lại'", async () => {
    await mount([
      {
        id: "r1",
        notebookId: "nb1",
        kind: "faq",
        content: "FAQ cũ",
        citations: [],
        createdAt: 1,
      },
    ]);
    act(() =>
      (q("[data-testid=studio-regen-faq]") as HTMLButtonElement).click(),
    );
    const btn = q("[data-testid=studio-cancel-faq]") as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.focus();
    act(() => btn.click());
    await act(async () =>
      settle[0].fail(new Error(encodeUserError("studioCancelled"))),
    );
    expect(q("[data-testid=studio-card-faq]")!.textContent).toContain("FAQ cũ");
    expect(document.activeElement).toBe(q("[data-testid=studio-regen-faq]"));
  });

  it("không cướp focus nếu người dùng đã rời nút Huỷ", async () => {
    await mount();
    start();
    const other = q("[data-testid=studio-btn-faq]") as HTMLButtonElement;
    act(() =>
      (q("[data-testid=studio-cancel-summary]") as HTMLButtonElement).click(),
    );
    other.focus();
    await act(async () =>
      settle[0].fail(new Error(encodeUserError("studioCancelled"))),
    );
    expect(document.activeElement).toBe(other);
  });

  it("CSS: hàng pha + nút Huỷ co giãn, không tràn", () => {
    const css = readFileSync("src/renderer/features/studio/studio.css", "utf8");
    const head = /\.studio-progress-head\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(head).toMatch(/display:\s*flex/);
    expect(head).toMatch(/flex-wrap:\s*wrap/);
    expect(head).toMatch(/min-width:\s*0/);
  });
});
