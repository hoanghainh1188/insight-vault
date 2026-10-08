// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { MessageBubble } from "../../src/renderer/features/rag-qa/MessageBubble";
import { I18nProvider } from "../../src/renderer/shared/i18n/I18nProvider";
import type { ChatMessage } from "../../src/renderer/features/rag-qa/useChat";

// 123 (FR-015, FR-016): câu "không tìm thấy" (cũ & mới) hiển thị theo ngôn ngữ HIỆN TẠI dựa trên cờ notFound,
// bỏ qua nội dung đã lưu (có thể là tiếng Việt cũ); "đang tái lập chỉ mục" dịch theo cờ reindexing.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (window as unknown as { api: unknown }).api = {
    getUiLanguage: () => Promise.resolve({ preference: "en", effective: "en" }),
    onUiLanguageChanged: () => () => undefined,
  };
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => act(() => root.unmount()));

const render = async (message: ChatMessage) => {
  act(() =>
    root.render(
      createElement(
        I18nProvider,
        null,
        createElement(MessageBubble, {
          message,
          onCite: () => undefined,
        } as never),
      ),
    ),
  );
  await act(async () => {});
};

describe("MessageBubble — câu do app sinh theo ngôn ngữ hiện tại", () => {
  it("notFound với nội dung Việt cũ ⇒ English khi giao diện English", async () => {
    await render({
      role: "assistant",
      content:
        "Không tìm thấy trong nguồn. Thử hỏi cụ thể hơn, hoặc chuyển sang chế độ Mở rộng nếu chấp nhận nội dung ngoài tài liệu.",
      citations: [],
      notFound: true,
    });
    expect(container.textContent).toContain("Not found in the sources.");
    expect(container.textContent).toContain("switch to Extended mode");
    expect(container.textContent).not.toContain("Không tìm thấy");
  });

  it("reindexing ⇒ câu dịch", async () => {
    await render({
      role: "assistant",
      content: "Reindexing sources. Please try again shortly.",
      citations: [],
      reindexing: true,
    });
    expect(container.textContent).toContain(
      "Reindexing sources (updating the local search engine)",
    );
  });

  it("câu trả lời thường giữ nguyên văn (không dịch nội dung AI)", async () => {
    await render({
      role: "assistant",
      content: "Vịnh Hạ Long có 1969 hòn đảo.",
      citations: [],
    });
    expect(container.textContent).toContain("Vịnh Hạ Long có 1969 hòn đảo.");
  });
});
