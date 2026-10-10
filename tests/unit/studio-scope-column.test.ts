// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { tagOnlineError } from "@shared/online-error-tag";
import type {
  Source,
  StudioGenerateInput,
  StudioResult,
} from "@shared/ipc/types";
import { pruneScope } from "../../src/renderer/features/studio/scope-prune";

// 178 (PR 4, review code-reviewer): phạm vi không được nới rộng ÂM THẦM — nguồn đã chọn hết ready ⇒ bỏ khỏi phạm vi + báo trình
// đọc màn hình; "Tạo lại" dùng phạm vi của PHIÊN BẢN đang xem (như yêu cầu tuỳ chỉnh); "Thử lại" dùng phạm vi của lượt vừa lỗi.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const announced = vi.hoisted(() => [] as string[]);
vi.mock("../../src/renderer/shared/a11y/announcer", () => ({
  announce: (msg: string) => announced.push(msg),
}));
const { StudioColumn } =
  await import("../../src/renderer/features/studio/StudioColumn");

const s = (id: string, status: Source["status"] = "ready"): Source =>
  ({ id, notebookId: "nb1", status, title: `Nguồn ${id}` }) as Source;

describe("pruneScope", () => {
  it("mọi id còn ready ⇒ trả CHÍNH mảng cũ (không đổi tham chiếu)", () => {
    const scope = ["a", "b"];
    expect(pruneScope(scope, [s("a"), s("b"), s("c")])).toBe(scope);
    const empty: string[] = [];
    expect(pruneScope(empty, [])).toBe(empty);
  });

  it("id không còn ready ⇒ mảng mới chỉ còn id ready (không mutate)", () => {
    const scope = Object.freeze(["a", "b", "c"]) as unknown as string[];
    expect(pruneScope(scope, [s("a"), s("c")])).toEqual(["a", "c"]);
    expect(scope).toEqual(["a", "b", "c"]);
  });
});

let container: HTMLDivElement;
let root: Root;
let sources: Source[];
let stored: StudioResult[];
let inputs: StudioGenerateInput[];
let settle: Array<{ ok: (v: unknown) => void; fail: (e: unknown) => void }>;
let sourceProgress: (e: { notebookId: string }) => void;

beforeEach(() => {
  announced.length = 0;
  sources = [s("a"), s("b"), s("c")];
  stored = [];
  inputs = [];
  settle = [];
  (window as unknown as { api: unknown }).api = {
    aiGetRuntimeStatus: () => Promise.resolve({ ollamaReady: true }),
    sourceListByNotebook: () => Promise.resolve(sources),
    onSourceProgress: (cb: (e: { notebookId: string }) => void) => {
      sourceProgress = cb;
      return () => undefined;
    },
    onStudioProgress: () => () => undefined,
    onStudioStreamToken: () => () => undefined,
    studioList: () => Promise.resolve(stored),
    studioCancel: () => Promise.resolve({ cancelled: true }),
    studioGenerate: (i: StudioGenerateInput) =>
      new Promise((ok, fail) => {
        inputs.push(i);
        settle.push({ ok, fail });
      }),
  };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const q = (sel: string) => container.querySelector(sel) as HTMLElement | null;
const click = (sel: string) => act(() => (q(sel) as HTMLElement).click());
const toggleText = () =>
  q("[data-testid=studio-scope-toggle]")!.textContent ?? "";

async function mount(): Promise<void> {
  await act(async () =>
    root.render(createElement(StudioColumn, { notebookId: "nb1" })),
  );
  await act(async () => {});
}

function choose(...titles: string[]): void {
  if (!q("[data-testid=studio-scope-list]")) {
    click("[data-testid=studio-scope-toggle]");
  }
  for (const t of titles) {
    const label = [
      ...container.querySelectorAll<HTMLLabelElement>(".studio-scope-item"),
    ].find((l) => l.textContent === t)!;
    act(() => label.querySelector("input")!.click());
  }
}

const version = (sourceIds?: string[]): StudioResult => ({
  id: "v1",
  notebookId: "nb1",
  kind: "summary",
  content: "x",
  citations: [],
  createdAt: 1,
  ...(sourceIds ? { sourceIds } : {}),
});

describe("StudioColumn — phạm vi (178 PR 4, review)", () => {
  it("nguồn đã chọn hết ready ⇒ bỏ khỏi phạm vi + báo; không âm thầm gửi 'tất cả'", async () => {
    await mount();
    choose("Nguồn b");
    expect(toggleText()).toBe("Phạm vi: 1 nguồn");
    sources = [s("a"), s("b", "error"), s("c")];
    await act(async () => sourceProgress({ notebookId: "nb1" }));
    await act(async () => {});
    expect(toggleText()).toBe("Phạm vi: Tất cả nguồn");
    expect(announced).toContain(
      "Phạm vi nguồn đã đổi: có nguồn đã chọn không còn sẵn sàng.",
    );
  });

  it("đổi notebook khi đang chọn phạm vi ⇒ về 'Tất cả nguồn', KHÔNG báo nhầm 'phạm vi đã đổi'", async () => {
    await mount();
    choose("Nguồn b");
    await act(async () =>
      root.render(createElement(StudioColumn, { notebookId: "nb2" })),
    );
    await act(async () => {});
    expect(toggleText()).toBe("Phạm vi: Tất cả nguồn");
    expect(announced.join("|")).not.toContain("Phạm vi nguồn đã đổi");
  });

  it("'Tạo lại' dùng phạm vi của phiên bản đang xem, không phải bộ chọn", async () => {
    stored = [version(["c"])];
    await mount();
    choose("Nguồn a");
    click("[data-testid=studio-regen-summary]");
    expect(inputs[0].sourceIds).toEqual(["c"]);
  });

  it("'Tạo lại' phiên bản không có phạm vi ⇒ mọi nguồn (không gửi sourceIds)", async () => {
    stored = [version()];
    await mount();
    choose("Nguồn a");
    click("[data-testid=studio-regen-summary]");
    expect("sourceIds" in inputs[0]).toBe(false);
  });

  it("nút loại dùng phạm vi bộ chọn; 'Thử lại' dùng phạm vi của lượt vừa lỗi", async () => {
    await mount();
    choose("Nguồn a", "Nguồn c");
    click("[data-testid=studio-btn-faq]");
    expect(inputs[0].sourceIds).toEqual(["a", "c"]);
    await act(async () =>
      settle[0].fail(new Error(tagOnlineError("Claude: lỗi", "rate-limit"))),
    );
    // đổi bộ chọn sau khi lỗi — Thử lại vẫn dùng phạm vi của lượt lỗi
    click("[data-testid=studio-scope-all]");
    expect(toggleText()).toBe("Phạm vi: Tất cả nguồn");
    click("[data-testid=studio-retry-faq]");
    expect(inputs[1].sourceIds).toEqual(["a", "c"]);
  });
});
