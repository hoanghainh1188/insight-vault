// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { readFileSync } from "node:fs";
import { StudioProgress } from "../../src/renderer/features/studio/StudioProgress";
import { I18nProvider } from "../../src/renderer/shared/i18n/I18nProvider";
import type { StudioProgressState } from "../../src/renderer/features/studio/studio-progress";

// 146 (T016): dòng pha + thanh tiến độ — pha đọc ⇒ xác định (valuenow/valuemax), pha khác ⇒ bất định (chỉ valuetext); en theo
// ngôn ngữ giao diện; (L1) CSS có khối prefers-reduced-motion tắt hiệu ứng.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => act(() => root.unmount()));

const bar = () =>
  container.querySelector("[role=progressbar]") as HTMLElement | null;

function renderVi(progress: StudioProgressState): void {
  act(() =>
    root.render(createElement(StudioProgress, { kind: "summary", progress })),
  );
}

async function renderEn(progress: StudioProgressState): Promise<void> {
  (window as unknown as { api: unknown }).api = {
    getUiLanguage: () => Promise.resolve({ preference: "en", effective: "en" }),
    onUiLanguageChanged: () => () => undefined,
  };
  act(() =>
    root.render(
      createElement(
        I18nProvider,
        null,
        createElement(StudioProgress, { kind: "faq", progress }),
      ),
    ),
  );
  await act(async () => {});
}

describe("StudioProgress", () => {
  it("pha đọc ⇒ 'Đang đọc phần 2/5…' + progressbar xác định 2/5", () => {
    renderVi({ generationId: "g", phase: "reading", index: 2, total: 5 });
    expect(container.textContent).toContain("Đang đọc phần 2/5…");
    const b = bar()!;
    expect(b.getAttribute("aria-valuenow")).toBe("2");
    expect(b.getAttribute("aria-valuemin")).toBe("0");
    expect(b.getAttribute("aria-valuemax")).toBe("5");
    expect(b.getAttribute("aria-valuetext")).toBe("Đang đọc phần 2/5…");
    expect(b.getAttribute("aria-label")).toContain("Tóm tắt tài liệu");
    expect(
      container.querySelector("[data-testid=studio-progress-summary]"),
    ).not.toBeNull();
  });

  it("pha rút gọn / viết ⇒ bất định: không valuenow, có valuetext", () => {
    renderVi({ generationId: "g", phase: "writing" });
    const b = bar()!;
    expect(b.hasAttribute("aria-valuenow")).toBe(false);
    expect(b.getAttribute("aria-valuetext")).toBe("Đang viết…");
    expect(b.className).toContain("indeterminate");
    renderVi({ generationId: "g", phase: "condensing" });
    expect(container.textContent).toContain("Đang rút gọn ghi chú…");
  });

  it("giao diện English ⇒ câu English", async () => {
    await renderEn({ generationId: "g", phase: "reading", index: 1, total: 3 });
    expect(container.textContent).toContain("Reading part 1 of 3…");
    expect(bar()!.getAttribute("aria-label")).toContain("FAQ");
  });

  it("(L1) CSS: prefers-reduced-motion tắt hiệu ứng thanh bất định", () => {
    const css = readFileSync("src/renderer/features/studio/studio.css", "utf8");
    const m =
      /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(css);
    expect(m?.[1] ?? "").toMatch(/studio-progress[\s\S]*animation:\s*none/);
  });
});
