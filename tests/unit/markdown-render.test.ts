// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import type { Citation } from "../../src/shared/ipc/types";
import { MarkdownContent } from "../../src/renderer/shared/markdown/MarkdownContent";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const cite: Citation = {
  n: 1,
  chunkId: "c1",
  sourceId: "s1",
  sourceTitle: "Tài liệu",
  locator: { page: 1, charStart: 0, charEnd: 5 },
};

function render(content: string, onCite?: (c: Citation) => void): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      createElement(MarkdownContent, {
        content,
        citeByN: new Map([[1, cite]]),
        onCite,
      }),
    ),
  );
  return host;
}

describe("MarkdownContent render (029)", () => {
  beforeEach(() => (document.body.innerHTML = ""));

  it("render markdown → phần tử đúng (strong/ul/h4/pre)", () => {
    const host = render("# T\n**đậm**\n\n- a\n- b\n\n```\ncode\n```");
    expect(host.querySelector("h4")).toBeTruthy();
    expect(host.querySelector("strong")?.textContent).toBe("đậm");
    expect(host.querySelectorAll(".md-ul li")).toHaveLength(2);
    // CommonMark giữ newline cuối trong khối code fence → "code\n".
    expect(host.querySelector("pre code")?.textContent?.trim()).toBe("code");
  });

  it("HTML thô KHÔNG được thực thi (không tạo <script>) — chỉ text", () => {
    const host = render("<script>alert(1)</script> và <b>x</b>");
    expect(host.querySelector("script")).toBeNull();
    // hiển thị dưới dạng text
    expect(host.textContent).toContain("<script>alert(1)</script>");
  });

  it("chip [n] → button.cite bấm gọi onCite; [n] trong code → literal", () => {
    const onCite = vi.fn();
    const host = render("theo [1] và `arr[1]`", onCite);
    const btn = host.querySelector<HTMLButtonElement>(
      'button.cite[data-testid="cite-1"]',
    );
    expect(btn).toBeTruthy();
    // đúng 1 chip (cái trong `code` là literal)
    expect(host.querySelectorAll("button.cite")).toHaveLength(1);
    // mã nội dòng render <code> (không nằm trong <pre>) — [1] giữ nguyên
    const inlineCode = host.querySelector(":not(pre) > code");
    expect(inlineCode?.textContent).toBe("arr[1]");
    btn!.click();
    expect(onCite).toHaveBeenCalledWith(cite);
  });

  it("link → text (không thẻ <a> điều hướng)", () => {
    const host = render("[Google](https://x.com)");
    expect(host.querySelector("a")).toBeNull();
    expect(host.querySelector(".md-link")?.textContent).toBe("Google");
  });

  it("xuống dòng đơn = cùng đoạn (soft break), dòng trống = đoạn mới (CommonMark)", () => {
    const host = render("dòng một\ndòng hai\n\nđoạn hai");
    // 2 đoạn: {dòng một + dòng hai} và {đoạn hai} — KHÔNG tách 3 dòng cứng như parser cũ.
    expect(host.querySelectorAll("p.md-p")).toHaveLength(2);
  });
});
