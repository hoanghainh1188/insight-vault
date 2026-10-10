// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import type {
  StudioGenerateInput,
  StudioProgressEvent,
  StudioResult,
  StudioStreamTokenEvent,
} from "@shared/ipc/types";

// 178 (PR 4, T067, FR-043/FR-044/FR-045): chữ tạm trong StudioColumn — văn bản thường đã gỡ [n] (không chip, không markdown),
// KHÔNG nằm trong vùng aria-live / role=status; "Tạo lại" ⇒ chữ tạm ở TRÊN phiên bản đang xem; xong ⇒ thay bằng phiên bản mới
// (có chip); trình đọc màn hình chỉ nghe các mốc (không từng mẩu chữ).

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const announced = vi.hoisted(() => [] as string[]);
vi.mock("../../src/renderer/shared/a11y/announcer", () => ({
  announce: (msg: string) => announced.push(msg),
}));
const { StudioColumn } =
  await import("../../src/renderer/features/studio/StudioColumn");

let container: HTMLDivElement;
let root: Root;
let pushToken: (e: StudioStreamTokenEvent) => void;
let pushProgress: (e: StudioProgressEvent) => void;
let inputs: StudioGenerateInput[];
let settle: Array<{ ok: (v: unknown) => void }>;
let stored: StudioResult[];

const cite = {
  n: 1,
  chunkId: "c1",
  sourceId: "s1",
  sourceTitle: "A",
  locator: { page: 1, charStart: 0, charEnd: 5 },
};
const ver = (id: string, content: string): StudioResult => ({
  id,
  notebookId: "nb1",
  kind: "summary",
  content,
  citations: [cite],
  createdAt: 1,
});

beforeEach(() => {
  announced.length = 0;
  inputs = [];
  settle = [];
  stored = [];
  (window as unknown as { api: unknown }).api = {
    aiGetRuntimeStatus: () => Promise.resolve({ ollamaReady: true }),
    sourceListByNotebook: () =>
      Promise.resolve([
        { id: "s1", notebookId: "nb1", status: "ready", title: "A" },
      ]),
    onSourceProgress: () => () => undefined,
    onStudioProgress: (cb: (e: StudioProgressEvent) => void) => {
      pushProgress = cb;
      return () => undefined;
    },
    onStudioStreamToken: (cb: (e: StudioStreamTokenEvent) => void) => {
      pushToken = cb;
      return () => undefined;
    },
    studioList: () => Promise.resolve(stored),
    studioCancel: () => Promise.resolve({ cancelled: true }),
    studioGenerate: (i: StudioGenerateInput) =>
      new Promise((ok) => {
        inputs.push(i);
        settle.push({ ok });
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
const stream = () => q("[data-testid=studio-stream-summary]");

async function mount(): Promise<void> {
  await act(async () =>
    root.render(createElement(StudioColumn, { notebookId: "nb1" })),
  );
  await act(async () => {});
}

function startWriting(button = "[data-testid=studio-btn-summary]"): string {
  act(() => (q(button) as HTMLButtonElement).click());
  const id = inputs[inputs.length - 1].generationId!;
  act(() =>
    pushProgress({
      generationId: id,
      notebookId: "nb1",
      kind: "summary",
      phase: "writing",
    }),
  );
  return id;
}

const tok = (generationId: string, delta: string): void =>
  act(() => pushToken({ generationId, delta }));

describe("StudioColumn — chữ tạm khi stream (178 PR 4)", () => {
  it("lần tạo đầu: chữ tạm hiện dần, đã gỡ [n], không chip, không markdown; tiến độ vẫn còn", async () => {
    await mount();
    const id = startWriting();
    expect(stream()).toBeNull();
    tok(id, "## Tiêu đề\n**Đậm** [1");
    tok(id, "] và [2, 3].");
    const s = stream()!;
    expect(s.textContent).toBe("## Tiêu đề\n**Đậm** và.");
    expect(s.querySelector(".cite, button, a, strong, h2")).toBeNull();
    expect(q("[data-testid=studio-progress-summary]")).not.toBeNull();
  });

  it("chữ tạm KHÔNG nằm trong vùng live / status; không announce từng mẩu", async () => {
    await mount();
    const id = startWriting();
    const before = announced.length;
    tok(id, "Một mẩu chữ");
    tok(id, " nữa");
    const s = stream()!;
    expect(
      s.closest("[aria-live], [role=status], [role=alert], [role=log]"),
    ).toBeNull();
    expect(s.querySelector("[aria-live], [role=status]")).toBeNull();
    expect(announced.length).toBe(before);
    expect(announced.join("|")).not.toContain("Một mẩu chữ");
  });

  it("xong ⇒ chữ tạm biến mất, thay bằng phiên bản mới có chip", async () => {
    await mount();
    const id = startWriting();
    tok(id, "Kết quả [1");
    await act(async () => settle[0].ok(ver("v1", "Kết quả [1].")));
    expect(stream()).toBeNull();
    const card = q("[data-testid=studio-card-summary]")!;
    expect(card.querySelector(".cite")).not.toBeNull();
  });

  it("Tạo lại: chữ tạm ở TRÊN phiên bản đang xem (thẻ cũ vẫn còn)", async () => {
    stored = [ver("v0", "Bản cũ [1].")];
    await mount();
    const id = startWriting("[data-testid=studio-regen-summary]");
    tok(id, "Bản mới đang viết [1]");
    const s = stream()!;
    const card = q("[data-testid=studio-card-summary]")!;
    expect(card.textContent).toContain("Bản cũ");
    expect(
      s.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(s.textContent).toBe("Bản mới đang viết");
  });

  it("Huỷ ⇒ chữ tạm biến mất ngay", async () => {
    await mount();
    const id = startWriting();
    tok(id, "abc");
    act(() =>
      (q("[data-testid=studio-cancel-summary]") as HTMLButtonElement).click(),
    );
    expect(stream()).toBeNull();
  });
});
