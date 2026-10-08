// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { SettingsLanguageSection } from "../../src/renderer/features/app-shell/SettingsLanguageSection";
import { I18nProvider } from "../../src/renderer/shared/i18n/I18nProvider";
import type { UiLanguageState } from "../../src/shared/ipc/types";

// 123 (FR-003, FR-004, US2): Cài đặt › Ngôn ngữ — 3 lựa chọn, tên ngôn ngữ tự xưng, chọn ⇒ IPC, áp dụng ngay.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let setUiLanguage: ReturnType<typeof vi.fn>;

function install(initial: UiLanguageState, fail = false) {
  setUiLanguage = vi.fn((p: "auto" | "vi" | "en") =>
    fail
      ? Promise.reject(new Error("io"))
      : Promise.resolve({ preference: p, effective: p === "auto" ? "vi" : p }),
  );
  (window as unknown as { api: unknown }).api = {
    getUiLanguage: () => Promise.resolve(initial),
    setUiLanguage,
    onUiLanguageChanged: () => () => undefined,
  };
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = async () => {
  act(() =>
    root.render(
      createElement(I18nProvider, null, createElement(SettingsLanguageSection)),
    ),
  );
  await act(async () => {});
};
const radio = (v: string) =>
  container.querySelector(`input[type=radio][value=${v}]`) as HTMLInputElement;
const labelOf = (v: string) => radio(v).closest("label")!.textContent;

describe("SettingsLanguageSection", () => {
  it("3 lựa chọn trong fieldset; lựa chọn hiện tại checked; tên ngôn ngữ tự xưng", async () => {
    install({ preference: "en", effective: "en" });
    await render();
    expect(container.querySelector("fieldset legend")?.textContent).toBe(
      "Language",
    );
    expect(radio("auto").checked).toBe(false);
    expect(radio("en").checked).toBe(true);
    expect(labelOf("vi")).toBe("Tiếng Việt");
    expect(labelOf("en")).toBe("English");
    expect(labelOf("auto")).toBe("Automatic (system language)");
  });

  it("chọn ⇒ gọi setUiLanguage và giao diện đổi ngay", async () => {
    install({ preference: "en", effective: "en" });
    await render();
    await act(async () => radio("vi").click());
    expect(setUiLanguage).toHaveBeenCalledWith("vi");
    expect(radio("vi").checked).toBe(true);
    expect(container.querySelector("fieldset legend")?.textContent).toBe(
      "Ngôn ngữ",
    );
    expect(labelOf("en")).toBe("English");
  });

  it("IPC lỗi ⇒ thông báo, không đổi lựa chọn", async () => {
    install({ preference: "auto", effective: "vi" }, true);
    await render();
    await act(async () => radio("en").click());
    expect(
      container.querySelector("[data-testid=language-error]")?.textContent,
    ).toBe("Không đổi được ngôn ngữ. Vui lòng thử lại.");
    expect(radio("auto").checked).toBe(true);
  });
});

describe("123 quickstart: lựa chọn phản hồi ngay khi bấm (không chờ IPC)", () => {
  it("IPC chưa trả ⇒ radio vừa chọn đã checked; IPC lỗi ⇒ trả về lựa chọn cũ", async () => {
    let reject: (e: Error) => void = () => undefined;
    install({ preference: "auto", effective: "vi" });
    setUiLanguage.mockImplementation(
      () => new Promise((_, rj) => (reject = rj)),
    );
    await render();
    await act(async () => radio("en").click());
    expect(radio("en").checked).toBe(true);
    await act(async () => reject(new Error("io")));
    expect(radio("auto").checked).toBe(true);
  });
});
