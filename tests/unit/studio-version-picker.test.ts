// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { createTranslator } from "@shared/i18n";
import type { StudioResult } from "@shared/ipc/types";
import { UiLanguageContext } from "../../src/renderer/shared/i18n/i18n-context";

// 178 (T017): bộ chọn phiên bản trên thẻ — select có nhãn (ẩn khi chỉ 1 bản), nút xoá có tên loại, xác nhận tại chỗ
// (alertdialog như SourceItem), huỷ xác nhận ⇒ không xoá, xoá xong ⇒ báo trình đọc màn hình + focus hợp lý.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const announced = vi.hoisted(() => [] as string[]);
vi.mock("../../src/renderer/shared/a11y/announcer", () => ({
  announce: (m: string) => announced.push(m),
}));
const { StudioVersionPicker } =
  await import("../../src/renderer/features/studio/StudioVersionPicker");

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  announced.length = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const q = (sel: string) => container.querySelector(sel) as HTMLElement | null;
const ver = (id: string, createdAt: number): StudioResult => ({
  id,
  notebookId: "nb1",
  kind: "summary",
  content: id,
  citations: [],
  createdAt,
});

function inEnglish(el: ReactElement): ReactElement {
  return createElement(
    UiLanguageContext.Provider,
    {
      value: {
        preference: "en",
        effective: "en",
        translator: createTranslator("en"),
        setPreference: async () => undefined,
      },
    },
    el,
  );
}

interface Props {
  versions: StudioResult[];
  currentId: string;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => Promise<string | undefined>;
  onEmptied?: () => void;
}
function picker(p: Props): ReactElement {
  return createElement(StudioVersionPicker, {
    kind: "summary",
    onSelect: () => undefined,
    onDelete: async () => undefined,
    ...p,
  });
}

describe("StudioVersionPicker (178)", () => {
  it("≥ 2 bản ⇒ select có nhãn, lựa chọn 'Bản n/total · thời gian' (bản mới nhất = n lớn nhất)", () => {
    act(() =>
      root.render(
        picker({ versions: [ver("b", 2000), ver("a", 1000)], currentId: "b" }),
      ),
    );
    const sel = q(
      "[data-testid=studio-version-select-summary]",
    ) as HTMLSelectElement;
    expect(sel).not.toBeNull();
    expect(sel.getAttribute("aria-label")).toBe("Phiên bản Tóm tắt tài liệu");
    const opts = [...sel.options].map((o) => o.textContent ?? "");
    expect(opts[0].startsWith("Bản 2/2 · ")).toBe(true);
    expect(opts[1].startsWith("Bản 1/2 · ")).toBe(true);
    expect(sel.value).toBe("b");
  });

  it("chỉ 1 bản ⇒ không có select nhưng vẫn có nút xoá", () => {
    act(() => root.render(picker({ versions: [ver("a", 1)], currentId: "a" })));
    expect(q("[data-testid=studio-version-select-summary]")).toBeNull();
    expect(q("[data-testid=studio-version-delete-summary]")).not.toBeNull();
  });

  it("đổi select ⇒ onSelect(id)", () => {
    const onSelect = vi.fn();
    act(() =>
      root.render(
        picker({
          versions: [ver("b", 2), ver("a", 1)],
          currentId: "b",
          onSelect,
        }),
      ),
    );
    const sel = q(
      "[data-testid=studio-version-select-summary]",
    ) as HTMLSelectElement;
    act(() => {
      sel.value = "a";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("nút xoá có tên đọc kèm loại; bấm ⇒ hiện xác nhận; Huỷ ⇒ không xoá, focus về nút xoá", () => {
    const onDelete = vi.fn(async () => undefined);
    act(() =>
      root.render(
        picker({
          versions: [ver("b", 2), ver("a", 1)],
          currentId: "b",
          onDelete,
        }),
      ),
    );
    const del = q(
      "[data-testid=studio-version-delete-summary]",
    ) as HTMLButtonElement;
    expect(del.getAttribute("aria-label")).toBe(
      "Xoá phiên bản đang xem của Tóm tắt tài liệu",
    );
    act(() => del.click());
    const dlg = q("[data-testid=studio-version-confirm-summary]");
    expect(dlg?.getAttribute("role")).toBe("alertdialog");
    act(() =>
      (
        q(
          "[data-testid=studio-version-confirm-cancel-summary]",
        ) as HTMLButtonElement
      ).click(),
    );
    expect(onDelete).not.toHaveBeenCalled();
    expect(q("[data-testid=studio-version-confirm-summary]")).toBeNull();
    expect(document.activeElement).toBe(
      q("[data-testid=studio-version-delete-summary]"),
    );
  });

  it("xác nhận ⇒ onDelete(id đang xem) + thông báo; còn bản ⇒ focus về select", async () => {
    const onDelete = vi.fn(async () => "a");
    const versions = [ver("c", 3), ver("b", 2), ver("a", 1)];
    act(() => root.render(picker({ versions, currentId: "b", onDelete })));
    act(() =>
      (
        q("[data-testid=studio-version-delete-summary]") as HTMLButtonElement
      ).click(),
    );
    await act(async () =>
      (
        q(
          "[data-testid=studio-version-confirm-ok-summary]",
        ) as HTMLButtonElement
      ).click(),
    );
    expect(onDelete).toHaveBeenCalledWith("b");
    expect(announced).toContain("Đã xoá một phiên bản Tóm tắt tài liệu.");
    act(() =>
      root.render(
        picker({
          versions: [ver("c", 3), ver("a", 1)],
          currentId: "a",
          onDelete,
        }),
      ),
    );
    expect(document.activeElement).toBe(
      q("[data-testid=studio-version-select-summary]"),
    );
  });

  it("xoá bản cuối ⇒ onEmptied (cột trả focus về nút loại)", async () => {
    const onEmptied = vi.fn();
    act(() =>
      root.render(
        picker({
          versions: [ver("a", 1)],
          currentId: "a",
          onDelete: async () => undefined,
          onEmptied,
        }),
      ),
    );
    act(() =>
      (
        q("[data-testid=studio-version-delete-summary]") as HTMLButtonElement
      ).click(),
    );
    await act(async () =>
      (
        q(
          "[data-testid=studio-version-confirm-ok-summary]",
        ) as HTMLButtonElement
      ).click(),
    );
    expect(onEmptied).toHaveBeenCalledTimes(1);
  });

  it("xoá lỗi ⇒ giữ hộp xác nhận + báo lỗi, không thông báo đã xoá", async () => {
    act(() =>
      root.render(
        picker({
          versions: [ver("a", 1)],
          currentId: "a",
          onDelete: () => Promise.reject(new Error("ipc")),
        }),
      ),
    );
    act(() =>
      (
        q("[data-testid=studio-version-delete-summary]") as HTMLButtonElement
      ).click(),
    );
    await act(async () =>
      (
        q(
          "[data-testid=studio-version-confirm-ok-summary]",
        ) as HTMLButtonElement
      ).click(),
    );
    expect(q("[data-testid=studio-version-confirm-summary]")).not.toBeNull();
    expect(q("[data-testid=studio-version-error-summary]")?.textContent).toBe(
      "Không xoá được phiên bản. Hãy thử lại.",
    );
    expect(announced).toEqual([]);
  });

  it("English: nhãn và câu xác nhận dịch", () => {
    act(() =>
      root.render(
        inEnglish(
          picker({ versions: [ver("b", 2), ver("a", 1)], currentId: "b" }),
        ),
      ),
    );
    const sel = q(
      "[data-testid=studio-version-select-summary]",
    ) as HTMLSelectElement;
    expect(sel.getAttribute("aria-label")).toBe("Document summary version");
    expect(sel.options[0].textContent?.startsWith("Version 2/2 · ")).toBe(true);
    act(() =>
      (
        q("[data-testid=studio-version-delete-summary]") as HTMLButtonElement
      ).click(),
    );
    expect(
      q("[data-testid=studio-version-confirm-summary]")?.textContent,
    ).toContain("Delete this version?");
  });
});
