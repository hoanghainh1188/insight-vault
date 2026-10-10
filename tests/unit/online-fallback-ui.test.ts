// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import {
  describeChatError,
  useChat,
} from "../../src/renderer/features/rag-qa/useChat";
import { useStudio } from "../../src/renderer/features/studio/useStudio";
import { MessageBubble } from "../../src/renderer/features/rag-qa/MessageBubble";
import { ChatColumn } from "../../src/renderer/features/rag-qa/ChatColumn";
import { tagOnlineError } from "../../src/shared/online-error-tag";
import { describeIpcError } from "../../src/renderer/shared/i18n/describe-error";
import { trVi, tVi } from "./helpers/t-vi";

// 098 — lỗi AI online ⇒ nút một chạm "Trả lời bằng AI cục bộ" / "Thử lại" cho ĐÚNG lượt đó (không tự chuyển).

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const onlineErr = (): Error =>
  new Error(
    `Error invoking remote method 'rag:askStream': Error: ${tagOnlineError("Claude: Nhà cung cấp đang giới hạn tốc độ.", "rate-limit")}`,
  );

let container: HTMLDivElement;
let root: Root;
let api: Record<string, ReturnType<typeof vi.fn>>;
const flush = (): Promise<void> => act(async () => undefined);
// 123: lỗi online hiển thị = nhãn provider + câu dịch theo loại (không còn câu gốc của main).
const ONLINE_MSG = `Claude: ${tVi("online.rate-limit")}`;

beforeEach(() => {
  api = {
    onRagStreamToken: vi.fn(() => () => undefined),
    onSourceProgress: vi.fn(() => () => undefined),
    onStudioProgress: vi.fn(() => () => undefined), // 146
    studioCancel: vi.fn(() => Promise.resolve({ cancelled: true })), // 149
    ragStop: vi.fn(() => Promise.resolve({ stopped: true })),
    chatHistory: vi.fn(() => Promise.resolve([])),
    chatClear: vi.fn(() => Promise.resolve({ cleared: true })),
    aiGetRuntimeStatus: vi.fn(() => Promise.resolve({ ollamaReady: true })),
    sourceListByNotebook: vi.fn(() =>
      Promise.resolve([{ id: "s1", status: "ready", title: "a" }]),
    ),
    ragAskStream: vi.fn(),
    studioList: vi.fn(() => Promise.resolve([])),
    studioGenerate: vi.fn(),
    aiGetSelectedModels: vi.fn(() => Promise.resolve({ chatModel: "m" })),
  };
  (window as unknown as { api: unknown }).api = api;
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => act(() => root.unmount()));

describe("useChat — lỗi online", () => {
  let chat: ReturnType<typeof useChat>;
  function Harness(): null {
    chat = useChat("nb1");
    return null;
  }

  it("lỗi online ⇒ thông điệp sạch + lượt chờ chọn; 'AI cục bộ' hỏi lại đúng câu với target local, không nhân đôi câu hỏi", async () => {
    api.ragAskStream
      .mockImplementationOnce(() => Promise.reject(onlineErr()))
      .mockImplementationOnce(() =>
        Promise.resolve({
          answer: "Trả lời [1]",
          citations: [],
          notFound: false,
          modeUsed: "grounded",
        }),
      );
    await act(async () => root.render(createElement(Harness)));
    await flush();
    await act(async () => void (await chat.send("Hợp đồng hết hạn khi nào?")));
    expect(chat.error && describeChatError(chat.error, trVi)).toBe(ONLINE_MSG);
    expect(chat.failedTurn).toEqual({ question: "Hợp đồng hết hạn khi nào?" });

    await act(async () => void (await chat.retryFailed("local")));
    const second = (api.ragAskStream.mock.calls[1] as unknown[])[0] as Record<
      string,
      unknown
    >;
    expect(second.target).toBe("local");
    expect(second.question).toBe("Hợp đồng hết hạn khi nào?");
    expect(second.history).toEqual([]);
    expect(chat.messages.filter((m) => m.role === "user")).toHaveLength(1);
    const last = chat.messages[chat.messages.length - 1];
    expect(last.answeredLocally).toBe(true);
    expect(chat.error).toBeNull();
    expect(chat.failedTurn).toBeNull();
  });

  it("lỗi online GIỮA stream (đã có phần trả lời dở) ⇒ hỏi lại bỏ cả phần dở, không nhân đôi", async () => {
    let onToken: (e: { streamId: string; delta: string }) => void = () =>
      undefined;
    api.onRagStreamToken.mockImplementation((cb: typeof onToken) => {
      onToken = cb;
      return () => undefined;
    });
    api.ragAskStream
      .mockImplementationOnce(async (input: { streamId: string }) => {
        onToken({ streamId: input.streamId, delta: "Phần dở" });
        throw onlineErr();
      })
      .mockImplementationOnce(() =>
        Promise.resolve({
          answer: "Đủ",
          citations: [],
          notFound: false,
          modeUsed: "grounded",
        }),
      );
    await act(async () => root.render(createElement(Harness)));
    await flush();
    await act(async () => void (await chat.send("Q")));
    expect(chat.messages.map((m) => m.content)).toEqual(["Q", "Phần dở"]);
    await act(async () => void (await chat.retryFailed("local")));
    expect(chat.messages.map((m) => m.content)).toEqual(["Q", "Đủ"]);
    expect(
      (
        (api.ragAskStream.mock.calls[1] as unknown[])[0] as {
          history: unknown[];
        }
      ).history,
    ).toEqual([]);
  });

  it("'Thử lại' ⇒ không gửi target local", async () => {
    api.ragAskStream
      .mockImplementationOnce(() => Promise.reject(onlineErr()))
      .mockImplementationOnce(() =>
        Promise.resolve({
          answer: "ok",
          citations: [],
          notFound: false,
          modeUsed: "grounded",
        }),
      );
    await act(async () => root.render(createElement(Harness)));
    await flush();
    await act(async () => void (await chat.send("Q")));
    await act(async () => void (await chat.retryFailed("active")));
    const second = (api.ragAskStream.mock.calls[1] as unknown[])[0] as Record<
      string,
      unknown
    >;
    expect(second.target).toBeUndefined();
    expect(chat.messages[chat.messages.length - 1].answeredLocally).toBeFalsy();
  });

  it("AI cục bộ chưa sẵn sàng ⇒ bấm 'AI cục bộ' báo lỗi rõ thay vì im lặng", async () => {
    let progress: (e: { notebookId: string }) => void = () => undefined;
    api.onSourceProgress.mockImplementation((cb: typeof progress) => {
      progress = cb;
      return () => undefined;
    });
    api.ragAskStream.mockImplementationOnce(() => Promise.reject(onlineErr()));
    await act(async () => root.render(createElement(Harness)));
    await flush();
    await act(async () => void (await chat.send("Q")));
    // Ollama ngừng chạy giữa phiên (lần kiểm tra lại thấy chưa sẵn sàng)
    api.aiGetRuntimeStatus.mockImplementation(() =>
      Promise.resolve({ ollamaReady: false }),
    );
    await act(async () => progress({ notebookId: "nb1" }));
    await flush();
    await act(async () => void (await chat.retryFailed("local")));
    expect(api.ragAskStream).toHaveBeenCalledTimes(1);
    expect(chat.error).toEqual({ kind: "localNotReady" });
    expect(describeChatError(chat.error!, trVi)).toBe(tVi("chat.blockRuntime"));
  });

  it("xoá hội thoại ⇒ bỏ luôn lượt lỗi đang chờ chọn", async () => {
    api.ragAskStream.mockImplementationOnce(() => Promise.reject(onlineErr()));
    await act(async () => root.render(createElement(Harness)));
    await flush();
    await act(async () => void (await chat.send("Q")));
    expect(chat.failedTurn).not.toBeNull();
    await act(async () => chat.clearHistory());
    await flush();
    expect(chat.failedTurn).toBeNull();
    expect(chat.error).toBeNull();
  });

  it("lỗi KHÔNG phải online ⇒ không có lượt chờ chọn (không hiện nút)", async () => {
    api.ragAskStream.mockImplementationOnce(() =>
      Promise.reject(
        new Error(
          "Error invoking remote method 'rag:askStream': Error: Runtime AI cục bộ chưa sẵn sàng.",
        ),
      ),
    );
    await act(async () => root.render(createElement(Harness)));
    await flush();
    await act(async () => void (await chat.send("Q")));
    // 123: lỗi không thẻ (không mã, không online) ⇒ câu chung theo ngôn ngữ hiện tại.
    expect(chat.error && describeChatError(chat.error, trVi)).toBe(
      tVi("errors.unexpected"),
    );
    expect(chat.failedTurn).toBeNull();
  });
});

describe("useStudio — lỗi online", () => {
  let studio: ReturnType<typeof useStudio>;
  function Harness(): null {
    studio = useStudio("nb1");
    return null;
  }

  it("lỗi online ⇒ đánh dấu loại đó; tạo lại bằng AI cục bộ gửi target local + gắn nhãn", async () => {
    api.studioGenerate
      .mockImplementationOnce(() => Promise.reject(onlineErr()))
      .mockImplementationOnce(() =>
        // 178: main lưu `local` cùng phiên bản (target local) — mock trả như main.
        Promise.resolve({
          id: "v1",
          kind: "summary",
          content: "x",
          citations: [],
          createdAt: 1,
          local: true,
        }),
      );
    await act(async () => root.render(createElement(Harness)));
    await flush();
    await act(async () => void (await studio.generate("summary")));
    expect(describeIpcError(studio.errors.summary!, trVi)).toBe(ONLINE_MSG);
    expect(studio.onlineFailed.summary).toBe(true);
    await act(
      async () => void (await studio.generate("summary", undefined, "local")),
    );
    expect((api.studioGenerate.mock.calls[1] as unknown[])[0]).toMatchObject({
      kind: "summary",
      target: "local",
    });
    expect(studio.onlineFailed.summary).toBeFalsy();
    expect(studio.results.summary?.local).toBe(true);
  });
});

describe("MessageBubble — nhãn AI cục bộ", () => {
  it("câu trả lời tạo bằng AI cục bộ có nhãn", () => {
    act(() =>
      root.render(
        createElement(MessageBubble, {
          message: {
            role: "assistant",
            content: "Trả lời",
            answeredLocally: true,
          },
        }),
      ),
    );
    expect(
      container.querySelector("[data-testid=local-badge]")?.textContent,
    ).toContain("AI cục bộ");
  });
});

describe("ChatColumn — khối lỗi online", () => {
  it("hiện 2 nút; bấm 'AI cục bộ' ⇒ focus về vùng hội thoại, thông báo nằm trong role=alert riêng", async () => {
    document.body.appendChild(container);
    api.ragAskStream
      .mockImplementationOnce(() => Promise.reject(onlineErr()))
      .mockImplementationOnce(() => new Promise(() => undefined));
    await act(async () =>
      root.render(createElement(ChatColumn, { notebookId: "nb1" })),
    );
    await flush();
    const input = container.querySelector<HTMLTextAreaElement>(
      "[data-testid=chat-input]",
    )!;
    act(() => {
      const set = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )!.set!;
      set.call(input, "Q");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>("[data-testid=chat-send]")!
        .click(),
    );
    await flush();
    const alert = container.querySelector("[role=alert]")!;
    expect(alert.tagName).toBe("P");
    expect(alert.textContent).toBe(ONLINE_MSG);
    const local = container.querySelector<HTMLButtonElement>(
      "[data-testid=chat-local-retry]",
    )!;
    expect(container.querySelector("[data-testid=chat-retry]")).not.toBeNull();
    local.focus();
    await act(async () => local.click());
    expect(document.activeElement).toBe(
      container.querySelector("[data-testid=chat-thread]"),
    );
    container.remove();
  });
});
