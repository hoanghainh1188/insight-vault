// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { createTranslator } from "@shared/i18n";
import type { StudioResult } from "@shared/ipc/types";
import { UiLanguageContext } from "../../src/renderer/shared/i18n/i18n-context";
import { StudioScopePicker } from "../../src/renderer/features/studio/StudioScopePicker";
import { StudioResultCard } from "../../src/renderer/features/studio/StudioResultCard";

// 178 (PR 4, T059, FR-030 / FR-033): bộ chọn phạm vi nhiều nguồn — nút disclosure (aria-expanded / aria-controls) mở danh sách
// checkbox có nhãn; Esc đóng + trả focus; chỉ hiện khi > 1 nguồn ready. Thẻ kết quả hiển thị phạm vi của phiên bản, kể cả
// nguồn đã xoá.

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

const q = <T extends HTMLElement = HTMLElement>(sel: string) =>
  container.querySelector(sel) as T | null;
const toggle = () => q<HTMLButtonElement>("[data-testid=studio-scope-toggle]")!;
const boxes = () => [
  ...container.querySelectorAll<HTMLInputElement>(
    "[data-testid=studio-scope-list] input[type=checkbox]",
  ),
];

const SOURCES = [
  { id: "a", title: "Hợp đồng A" },
  { id: "b", title: "Hợp đồng B" },
  { id: "c", title: "Biên bản C" },
];

const en = (e: ReactElement): ReactElement =>
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
  );

function render(
  props: Partial<{
    sources: { id: string; title: string }[];
    selected: string[];
    onChange: (ids: readonly string[]) => void;
    disabled: boolean;
  }> = {},
  wrap: (e: ReactElement) => ReactElement = (e) => e,
): void {
  act(() =>
    root.render(
      wrap(
        createElement(StudioScopePicker, {
          sources: SOURCES,
          selected: [],
          onChange: () => undefined,
          ...props,
        }),
      ),
    ),
  );
}

describe("StudioScopePicker (178 PR 4)", () => {
  it("≤ 1 nguồn ready ⇒ không hiển thị", () => {
    render({ sources: [SOURCES[0]] });
    expect(toggle()).toBeNull();
    render({ sources: [] });
    expect(toggle()).toBeNull();
  });

  it("nút disclosure: nhãn 'Phạm vi: Tất cả nguồn', aria-expanded=false, aria-controls trỏ danh sách", () => {
    render();
    expect(toggle().textContent).toBe("Phạm vi: Tất cả nguồn");
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(q("[data-testid=studio-scope-list]")).toBeNull();
    act(() => toggle().click());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    const list = q("[data-testid=studio-scope-list]")!;
    expect(list.id).not.toBe("");
    expect(toggle().getAttribute("aria-controls")).toBe(list.id);
  });

  it("danh sách checkbox có nhãn = tên nguồn; phản ánh lựa chọn", () => {
    render({ selected: ["b"] });
    expect(toggle().textContent).toBe("Phạm vi: 1 nguồn");
    act(() => toggle().click());
    const bs = boxes();
    expect(bs).toHaveLength(3);
    expect(bs.map((b) => b.closest("label")?.textContent)).toEqual([
      "Hợp đồng A",
      "Hợp đồng B",
      "Biên bản C",
    ]);
    expect(bs.map((b) => b.checked)).toEqual([false, true, false]);
  });

  it("tick / bỏ tick ⇒ onChange với mảng mới (không mutate), giữ thứ tự nguồn", () => {
    const onChange = vi.fn();
    const selected = Object.freeze(["c"]) as unknown as string[];
    render({ selected, onChange });
    act(() => toggle().click());
    act(() => boxes()[0].click());
    expect(onChange).toHaveBeenLastCalledWith(["a", "c"]);
    act(() => boxes()[2].click());
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(selected).toEqual(["c"]);
  });

  it("nút 'Tất cả nguồn' trong danh sách ⇒ onChange([])", () => {
    const onChange = vi.fn();
    render({ selected: ["a", "b"], onChange });
    expect(toggle().textContent).toBe("Phạm vi: 2 nguồn");
    act(() => toggle().click());
    act(() => q<HTMLButtonElement>("[data-testid=studio-scope-all]")!.click());
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("Esc trong danh sách ⇒ đóng + trả focus về nút", () => {
    render();
    act(() => toggle().click());
    boxes()[1].focus();
    act(() => {
      boxes()[1].dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(q("[data-testid=studio-scope-list]")).toBeNull();
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle());
  });

  it("disabled ⇒ nút khoá", () => {
    render({ disabled: true });
    expect(toggle().disabled).toBe(true);
  });

  it("English", () => {
    render({ selected: ["a", "b"] }, en);
    expect(toggle().textContent).toBe("Scope: 2 sources");
    render({ selected: ["a"] }, en);
    expect(toggle().textContent).toBe("Scope: 1 source");
    render({ selected: [] }, en);
    expect(toggle().textContent).toBe("Scope: All sources");
  });
});

describe("StudioResultCard — phạm vi của phiên bản (178 PR 4)", () => {
  const res = (sourceIds?: string[]): StudioResult => ({
    id: "v1",
    notebookId: "nb1",
    kind: "summary",
    content: "Nội dung",
    citations: [],
    createdAt: 1,
    ...(sourceIds ? { sourceIds } : {}),
  });
  const card = (
    r: StudioResult,
    knownSourceIds?: ReadonlySet<string>,
    wrap: (e: ReactElement) => ReactElement = (e) => e,
  ): void =>
    act(() =>
      root.render(
        wrap(
          createElement(StudioResultCard, {
            result: r,
            regenerating: false,
            onRegenerate: () => undefined,
            knownSourceIds,
          }),
        ),
      ),
    );
  const note = () => q("[data-testid=studio-scope-note-summary]");

  it("không có sourceIds ⇒ không ghi chú phạm vi", () => {
    card(res(), new Set(["a"]));
    expect(note()).toBeNull();
  });

  it("có sourceIds ⇒ 'Phạm vi: 2 nguồn'", () => {
    card(res(["a", "b"]), new Set(["a", "b", "c"]));
    expect(note()?.textContent).toBe("Phạm vi: 2 nguồn");
  });

  it("id không còn trong notebook ⇒ vẫn hiển thị, ghi 'nguồn đã xoá'", () => {
    card(res(["a", "gone"]), new Set(["a"]));
    expect(q("[data-testid=studio-card-summary]")).not.toBeNull();
    expect(note()?.textContent).toBe("Phạm vi: 2 nguồn · 1 nguồn đã xoá");
  });

  it("English", () => {
    card(res(["a", "x", "y"]), new Set(["a"]), en);
    expect(note()?.textContent).toBe("Scope: 3 sources · 2 deleted sources");
  });
});
