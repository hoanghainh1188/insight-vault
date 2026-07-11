// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, useRef, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import {
  createModalKeydownHandler,
  focusableIn,
  useModalA11y,
} from "../../src/renderer/shared/useModalA11y";

// React 18 act environment.
(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function buildModal(): { container: HTMLElement; btns: HTMLButtonElement[] } {
  document.body.innerHTML = "";
  const container = document.createElement("div");
  const b1 = document.createElement("button");
  b1.textContent = "first";
  const b2 = document.createElement("button");
  b2.textContent = "mid";
  const b3 = document.createElement("button");
  b3.textContent = "last";
  container.append(b1, b2, b3);
  document.body.append(container);
  return { container, btns: [b1, b2, b3] };
}

function tab(shift = false): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: "Tab", shiftKey: shift });
}

describe("useModalA11y — createModalKeydownHandler", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("Escape gọi onClose", () => {
    const { container } = buildModal();
    const onClose = vi.fn();
    const handler = createModalKeydownHandler(container, onClose);
    handler(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("Tab tại phần tử cuối → vòng về đầu (trap)", () => {
    const { container, btns } = buildModal();
    const handler = createModalKeydownHandler(container, vi.fn());
    btns[2].focus(); // last
    const e = tab();
    const prevent = vi.spyOn(e, "preventDefault");
    handler(e);
    expect(prevent).toHaveBeenCalled();
    expect(document.activeElement).toBe(btns[0]);
  });

  it("Shift+Tab tại phần tử đầu → vòng về cuối", () => {
    const { container, btns } = buildModal();
    const handler = createModalKeydownHandler(container, vi.fn());
    btns[0].focus(); // first
    handler(tab(true));
    expect(document.activeElement).toBe(btns[2]);
  });

  it("Tab ở giữa → KHÔNG can thiệp (để trình duyệt xử lý)", () => {
    const { container, btns } = buildModal();
    const handler = createModalKeydownHandler(container, vi.fn());
    btns[1].focus(); // mid
    const e = tab();
    const prevent = vi.spyOn(e, "preventDefault");
    handler(e);
    expect(prevent).not.toHaveBeenCalled();
  });

  it("phím khác Escape/Tab → bỏ qua", () => {
    const { container } = buildModal();
    const onClose = vi.fn();
    const handler = createModalKeydownHandler(container, onClose);
    handler(new KeyboardEvent("keydown", { key: "a" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("focusableIn liệt kê các nút trong container", () => {
    const { container } = buildModal();
    expect(focusableIn(container)).toHaveLength(3);
  });
});

// Harness render hook thật để phủ thân useModalA11y (focus phần tử đầu + gắn/gỡ listener).
function Harness(props: {
  active: boolean;
  onClose: () => void;
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y({
    active: props.active,
    onClose: props.onClose,
    containerRef: ref,
  });
  return createElement(
    "div",
    { ref },
    createElement("button", { key: "a" }, "first"),
    createElement("button", { key: "b" }, "last"),
  );
}

describe("useModalA11y — hook", () => {
  let host: HTMLElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    document.body.innerHTML = "";
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  it("active=true → focus phần tử đầu + Escape gọi onClose", () => {
    const onClose = vi.fn();
    act(() => root.render(createElement(Harness, { active: true, onClose })));
    expect((document.activeElement as HTMLElement)?.textContent).toBe("first");

    act(() =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    );
    expect(onClose).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });

  it("unmount → gỡ listener (Escape không còn gọi onClose)", () => {
    const onClose = vi.fn();
    act(() => root.render(createElement(Harness, { active: true, onClose })));
    act(() => root.unmount());
    onClose.mockClear();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("active=false → không gắn listener (Escape bị bỏ qua)", () => {
    const onClose = vi.fn();
    act(() => root.render(createElement(Harness, { active: false, onClose })));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
});
