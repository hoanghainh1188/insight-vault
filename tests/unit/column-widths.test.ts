// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import {
  clampWidths,
  parseWidths,
  useColumnWidths,
} from "../../src/renderer/features/sources/useColumnWidths";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function pointerEvent(type: string, clientX: number): Event {
  const ev = new Event(type, { bubbles: true });
  Object.defineProperty(ev, "clientX", { value: clientX });
  return ev;
}

describe("useColumnWidths — clamp/parse (025)", () => {
  it("clamp src vào [220,460], studio vào [200,420]", () => {
    expect(clampWidths({ src: 100, studio: 100 })).toEqual({
      src: 220,
      studio: 200,
    });
    expect(clampWidths({ src: 999, studio: 999 })).toEqual({
      src: 460,
      studio: 420,
    });
    expect(clampWidths({ src: 300, studio: 260 })).toEqual({
      src: 300,
      studio: 260,
    });
  });

  it("làm tròn số lẻ", () => {
    expect(clampWidths({ src: 300.7, studio: 260.2 })).toEqual({
      src: 301,
      studio: 260,
    });
  });

  it("parse null/hỏng/thiếu field → mặc định {300,260}", () => {
    const def = { src: 300, studio: 260 };
    expect(parseWidths(null)).toEqual(def);
    expect(parseWidths("{ khong phai json")).toEqual(def);
    expect(parseWidths(JSON.stringify({ src: 300 }))).toEqual(def);
  });

  it("parse hợp lệ → clamp", () => {
    expect(parseWidths(JSON.stringify({ src: 999, studio: 100 }))).toEqual({
      src: 460,
      studio: 200,
    });
  });
});

// Harness phơi API hook để test drag + cleanup listener (phủ startDrag/onMove/onUp).
let hookApi: ReturnType<typeof useColumnWidths> | null = null;
function Harness(): null {
  hookApi = useColumnWidths();
  return null;
}

describe("useColumnWidths — hook drag (025)", () => {
  beforeEach(() => {
    localStorage.clear();
    hookApi = null;
  });

  it("kéo splitter Nguồn → src tăng theo delta (clamp) + persist + gỡ listener", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(createElement(Harness)));
    const startSrc = hookApi!.widths.src;

    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");

    // pointerdown tại x=100 (fake React event) → gắn listener document.
    act(() =>
      hookApi!.onDragSrc({
        clientX: 100,
        preventDefault: () => {},
      } as unknown as React.PointerEvent),
    );
    expect(addSpy).toHaveBeenCalledWith("pointermove", expect.any(Function));

    // Kéo sang phải 40px → src tăng ~40 (clamp trong [220,460]).
    act(() => document.dispatchEvent(pointerEvent("pointermove", 140)));
    expect(hookApi!.widths.src).toBe(
      clampWidths({ ...hookApi!.widths, src: startSrc + 40 }).src,
    );

    // pointerup → persist localStorage + gỡ cả 2 listener.
    act(() => document.dispatchEvent(pointerEvent("pointerup", 140)));
    expect(localStorage.getItem("workspace-col-widths")).toBeTruthy();
    expect(removeSpy).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("pointerup", expect.any(Function));

    act(() => root.unmount());
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("kéo splitter Studio → studio giảm khi kéo phải (sign -1)", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(createElement(Harness)));
    const startStudio = hookApi!.widths.studio;

    act(() =>
      hookApi!.onDragStudio({
        clientX: 100,
        preventDefault: () => {},
      } as unknown as React.PointerEvent),
    );
    act(() => document.dispatchEvent(pointerEvent("pointermove", 150)));
    // kéo phải 50 → studio = startStudio - 50 (clamp).
    expect(hookApi!.widths.studio).toBe(
      clampWidths({ ...hookApi!.widths, studio: startStudio - 50 }).studio,
    );
    act(() => document.dispatchEvent(pointerEvent("pointerup", 150)));
    act(() => root.unmount());
  });
});
