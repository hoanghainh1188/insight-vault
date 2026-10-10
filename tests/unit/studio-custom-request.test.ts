// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { createTranslator } from "@shared/i18n";
import { UiLanguageContext } from "../../src/renderer/shared/i18n/i18n-context";
import { StudioCustomRequest } from "../../src/renderer/features/studio/StudioCustomRequest";

// 178 (T046, FR-020): ô yêu cầu tuỳ chỉnh — textarea có nhãn, đếm "n/500" theo code point (aria-describedby), vượt giới hạn ⇒
// nút Tạo khoá + báo (không cắt ngầm), rỗng ⇒ khoá, Ctrl/Cmd+Enter gửi, "Đang tạo…" khi loading.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const q = <T extends HTMLElement>(sel: string) =>
  container.querySelector(sel) as T | null;
const area = () => q<HTMLTextAreaElement>("[data-testid=studio-custom-input]")!;
const btn = () => q<HTMLButtonElement>("[data-testid=studio-custom-submit]")!;

function type(value: string): void {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!;
    setter.call(area(), value);
    area().dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function render(
  props: Partial<{
    loading: boolean;
    disabled: boolean;
    onSubmit: (t: string) => void;
  }> = {},
  wrap: (e: ReactElement) => ReactElement = (e) => e,
): void {
  act(() =>
    root.render(
      wrap(
        createElement(StudioCustomRequest, {
          loading: false,
          disabled: false,
          onSubmit: () => undefined,
          ...props,
        }),
      ),
    ),
  );
}

describe("StudioCustomRequest (178)", () => {
  it("textarea có nhãn; bộ đếm gắn aria-describedby; rỗng ⇒ nút Tạo khoá", () => {
    render();
    const id = area().id;
    expect(id).not.toBe("");
    expect(q(`label[for="${id}"]`)?.textContent).toBe("Yêu cầu tuỳ chỉnh");
    const counter = q("[data-testid=studio-custom-counter]")!;
    expect(area().getAttribute("aria-describedby")).toContain(counter.id);
    expect(counter.textContent).toBe("0/500");
    expect(btn().disabled).toBe(true);
    type("   ");
    expect(btn().disabled).toBe(true);
  });

  it("đếm theo code point (emoji = 1); hợp lệ ⇒ bấm Tạo gửi văn bản", () => {
    const onSubmit = vi.fn();
    render({ onSubmit });
    type("Rủi ro 😀");
    expect(q("[data-testid=studio-custom-counter]")!.textContent).toBe("8/500");
    expect(btn().disabled).toBe(false);
    act(() => btn().click());
    expect(onSubmit).toHaveBeenCalledWith("Rủi ro 😀");
  });

  it("vượt 500 ⇒ không cắt ngầm, nút khoá, báo tối đa", () => {
    render();
    type("a".repeat(501));
    expect(area().value).toHaveLength(501);
    expect(btn().disabled).toBe(true);
    expect(q("[data-testid=studio-custom-toolong]")?.textContent).toBe(
      "Tối đa 500 ký tự.",
    );
    expect(area().getAttribute("aria-invalid")).toBe("true");
  });

  it("Ctrl+Enter / Cmd+Enter gửi; Enter thường không gửi", () => {
    const onSubmit = vi.fn();
    render({ onSubmit });
    type("Liệt kê");
    const key = (init: KeyboardEventInit) =>
      act(() => {
        area().dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            bubbles: true,
            ...init,
          }),
        );
      });
    key({});
    expect(onSubmit).not.toHaveBeenCalled();
    key({ ctrlKey: true });
    key({ metaKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("loading ⇒ nút 'Đang tạo…' khoá; disabled (chưa có nguồn) ⇒ khoá cả ô", () => {
    render({ loading: true });
    type("x");
    expect(btn().textContent).toBe("Đang tạo…");
    expect(btn().disabled).toBe(true);
    render({ disabled: true });
    expect(area().disabled).toBe(true);
    expect(btn().disabled).toBe(true);
  });

  it("English", () => {
    render({}, (e) =>
      createElement(
        UiLanguageContext.Provider,
        {
          value: {
            preference: "en",
            effective: "en",
            translator: createTranslator("en"),
            setPreference: async () => undefined,
          },
        },
        e,
      ),
    );
    expect(q("label")?.textContent).toBe("Custom request");
    expect(btn().textContent).toBe("Create");
    expect(btn().getAttribute("aria-label")).toBe("Create from custom request");
  });
});
