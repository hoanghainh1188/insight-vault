// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { ChatColumn } from "../../src/renderer/features/rag-qa/ChatColumn";
import { I18nProvider } from "../../src/renderer/shared/i18n/I18nProvider";
import type { UiLanguageState } from "../../src/shared/ipc/types";
import { tEn, tVi } from "./helpers/t-vi";

// 123 (tasks E1/T023, FR-004): đổi ngôn ngữ khi Chat đang stream ⇒ KHÔNG huỷ stream, giữ phần đã nhận;
// chỉ chrome (nhãn, nút, gợi ý) đổi ngôn ngữ.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let api: Record<string, ReturnType<typeof vi.fn>>;
let emitToken: (e: { streamId: string; delta: string }) => void;
let emitLang: (s: UiLanguageState) => void;
const flush = (): Promise<void> => act(async () => undefined);
const q = (id: string): HTMLElement | null =>
  container.querySelector(`[data-testid=${id}]`);

beforeEach(() => {
  emitToken = () => undefined;
  emitLang = () => undefined;
  api = {
    getUiLanguage: vi.fn(() =>
      Promise.resolve({ preference: "vi", effective: "vi" }),
    ),
    onUiLanguageChanged: vi.fn((cb: typeof emitLang) => {
      emitLang = cb;
      return () => undefined;
    }),
    onRagStreamToken: vi.fn((cb: typeof emitToken) => {
      emitToken = cb;
      return () => undefined;
    }),
    onSourceProgress: vi.fn(() => () => undefined),
    ragStop: vi.fn(() => Promise.resolve({ stopped: true })),
    chatHistory: vi.fn(() => Promise.resolve([])),
    chatClear: vi.fn(() => Promise.resolve({ cleared: true })),
    aiGetRuntimeStatus: vi.fn(() => Promise.resolve({ ollamaReady: true })),
    sourceListByNotebook: vi.fn(() =>
      Promise.resolve([{ id: "s1", status: "ready", title: "a" }]),
    ),
    // Stream chưa kết thúc (không resolve) — token phát qua listener.
    ragAskStream: vi.fn(() => new Promise(() => undefined)),
    aiGetSelectedModels: vi.fn(() => Promise.resolve({ chatModel: "m" })),
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

describe("ChatColumn — đổi ngôn ngữ giữa stream", () => {
  it("stream không bị huỷ, phần đã nhận giữ nguyên; nhãn đổi sang English", async () => {
    await act(async () =>
      root.render(
        createElement(
          I18nProvider,
          null,
          createElement(ChatColumn, { notebookId: "nb1" }),
        ),
      ),
    );
    await flush();
    expect(q("mode-hint")!.textContent).toBe(tVi("chat.mode.groundedHint"));

    const input = q("chat-input") as HTMLTextAreaElement;
    act(() => {
      const set = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )!.set!;
      set.call(input, "Hợp đồng hết hạn khi nào?");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => (q("chat-send") as HTMLButtonElement).click());
    await flush();
    const streamId = (
      (api.ragAskStream.mock.calls[0] as unknown[])[0] as { streamId: string }
    ).streamId;
    act(() => emitToken({ streamId, delta: "Hợp đồng hết hạn " }));
    expect(q("bubble-streaming")!.textContent).toBe("Hợp đồng hết hạn ");

    // Đổi ngôn ngữ giao diện (sự kiện từ main).
    await act(async () => emitLang({ preference: "en", effective: "en" }));
    await flush();

    expect(api.ragStop).not.toHaveBeenCalled();
    expect(q("chat-stop")).not.toBeNull();
    expect(q("bubble-streaming")!.textContent).toBe("Hợp đồng hết hạn ");
    // Token tiếp theo vẫn nối vào đúng bong bóng.
    act(() => emitToken({ streamId, delta: "ngày 31/12." }));
    expect(q("bubble-streaming")!.textContent).toBe(
      "Hợp đồng hết hạn ngày 31/12.",
    );
    // Chrome đổi ngôn ngữ.
    expect(q("chat-stop")!.getAttribute("aria-label")).toBe(tEn("chat.stop"));
    expect(q("mode-grounded")!.textContent).toBe(tEn("chat.mode.grounded"));
    expect(q("mode-hint")!.textContent).toBe(tEn("chat.mode.groundedHint"));
    expect(container.querySelector(".chat-head h2")!.textContent).toBe(
      tEn("chat.title"),
    );
    // Câu hỏi của người dùng giữ nguyên văn.
    expect(q("bubble-user")!.textContent).toContain(
      "Hợp đồng hết hạn khi nào?",
    );
    expect(q("bubble-user")!.textContent).toContain(tEn("chat.you"));
  });
});
