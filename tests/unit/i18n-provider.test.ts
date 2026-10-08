// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { I18nProvider } from "../../src/renderer/shared/i18n/I18nProvider";
import {
  useT,
  useUiLanguage,
} from "../../src/renderer/shared/i18n/i18n-context";
import type { UiLanguageState } from "../../src/shared/ipc/types";

// 123 (FR-004, FR-006; research R6): provider đọc ngôn ngữ hiệu lực, cập nhật theo sự kiện, đồng bộ <html lang>;
// không provider ⇒ tiếng Việt (test component cũ render không provider).

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let push: (s: UiLanguageState) => void = () => undefined;
const off = vi.fn();
let setUiLanguage: ReturnType<typeof vi.fn>;

function Title() {
  const t = useT();
  return createElement("h2", { "data-testid": "title" }, t.t("settings.title"));
}

function Typing() {
  const [v, setV] = useState("đang gõ dở");
  const t = useT();
  return createElement("input", {
    "data-testid": "typing",
    "aria-label": t.t("settings.title"),
    value: v,
    onChange: (e: { target: { value: string } }) => setV(e.target.value),
  });
}

function Pref() {
  const ui = useUiLanguage();
  return createElement(
    "button",
    {
      "data-testid": "pref",
      onClick: () => void ui.setPreference("vi"),
    },
    `${ui.preference}/${ui.effective}`,
  );
}

const q = (id: string) =>
  container.querySelector(`[data-testid=${id}]`) as HTMLElement | null;
const flush = () => act(async () => {});

beforeEach(() => {
  setUiLanguage = vi.fn((p: "auto" | "vi" | "en") =>
    Promise.resolve({ preference: p, effective: p === "auto" ? "en" : p }),
  );
  (window as unknown as { api: unknown }).api = {
    getUiLanguage: () =>
      Promise.resolve({ preference: "auto", effective: "en" }),
    setUiLanguage,
    onUiLanguageChanged: (cb: (s: UiLanguageState) => void) => {
      push = cb;
      return off;
    },
  };
  document.documentElement.lang = "vi";
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => act(() => root.unmount()));

describe("useT không provider", () => {
  it("fallback tiếng Việt", () => {
    act(() => root.render(createElement(Title)));
    expect(q("title")?.textContent).toBe("Cài đặt");
  });
});

describe("I18nProvider", () => {
  it("mount ⇒ đọc ngôn ngữ hiệu lực, hiển thị theo đó, đặt <html lang>", async () => {
    act(() =>
      root.render(createElement(I18nProvider, null, createElement(Title))),
    );
    await flush();
    expect(q("title")?.textContent).toBe("Settings");
    expect(document.documentElement.lang).toBe("en");
  });

  it("sự kiện đổi ngôn ngữ ⇒ re-render ngay, giữ state đang gõ", async () => {
    act(() =>
      root.render(
        createElement(
          I18nProvider,
          null,
          createElement(Title),
          createElement(Typing),
        ),
      ),
    );
    await flush();
    act(() => push({ preference: "vi", effective: "vi" }));
    expect(q("title")?.textContent).toBe("Cài đặt");
    expect((q("typing") as HTMLInputElement).value).toBe("đang gõ dở");
    expect(q("typing")?.getAttribute("aria-label")).toBe("Cài đặt");
    expect(document.documentElement.lang).toBe("vi");
  });

  it("setPreference gọi IPC và áp dụng kết quả trả về", async () => {
    act(() =>
      root.render(createElement(I18nProvider, null, createElement(Pref))),
    );
    await flush();
    expect(q("pref")?.textContent).toBe("auto/en");
    await act(async () => q("pref")!.click());
    expect(setUiLanguage).toHaveBeenCalledWith("vi");
    expect(q("pref")?.textContent).toBe("vi/vi");
  });

  it("unmount huỷ đăng ký sự kiện", async () => {
    act(() =>
      root.render(createElement(I18nProvider, null, createElement(Title))),
    );
    await flush();
    act(() => root.unmount());
    expect(off).toHaveBeenCalled();
    root = createRoot(container);
  });

  it("window.api thiếu / IPC lỗi ⇒ vẫn render (tiếng Việt), không crash", async () => {
    (window as unknown as { api: unknown }).api = {
      getUiLanguage: () => Promise.reject(new Error("x")),
      onUiLanguageChanged: () => () => undefined,
    };
    act(() =>
      root.render(createElement(I18nProvider, null, createElement(Title))),
    );
    await flush();
    expect(q("title")?.textContent).toBe("Cài đặt");
  });
});

describe("123 review: IPC treo ⇒ dự phòng", () => {
  it("getUiLanguage không bao giờ trả ⇒ sau 1,5 s vẫn render tiếng Việt", async () => {
    vi.useFakeTimers();
    (window as unknown as { api: unknown }).api = {
      getUiLanguage: () => new Promise(() => undefined),
      onUiLanguageChanged: () => () => undefined,
    };
    act(() =>
      root.render(createElement(I18nProvider, null, createElement(Title))),
    );
    expect(q("title")).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });
    expect(q("title")?.textContent).toBe("Cài đặt");
    vi.useRealTimers();
  });
});
