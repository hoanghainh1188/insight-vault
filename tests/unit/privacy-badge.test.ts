// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { PrivacyBadge } from "../../src/renderer/features/app-shell/PrivacyBadge";
import type { PrivacyState } from "../../src/shared/ipc/types";

// 103 — badge cập nhật TỨC THÌ theo sự kiện đẩy từ main; 3 trạng thái có class riêng.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let push: (s: PrivacyState) => void = () => undefined;
const off = vi.fn();

beforeEach(() => {
  (window as unknown as { api: unknown }).api = {
    getPrivacyState: () =>
      Promise.resolve({
        mode: "online",
        label: "AI online đang bật · chỉ gửi khi bạn hỏi",
      }),
    onPrivacyChanged: (cb: (s: PrivacyState) => void) => {
      push = cb;
      return off;
    },
  };
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => act(() => root.unmount()));

const badge = (): HTMLElement =>
  container.querySelector("[data-testid=privacy-badge]")!;

describe("PrivacyBadge", () => {
  it("đọc trạng thái ban đầu rồi đổi theo sự kiện đẩy (online → sending → online)", async () => {
    await act(async () => root.render(createElement(PrivacyBadge)));
    expect(badge().className).toContain("online");
    expect(badge().textContent).toContain("chỉ gửi khi bạn hỏi");

    act(() => push({ mode: "sending", label: "Đang gửi dữ liệu ra ngoài…" }));
    expect(badge().className).toContain("sending");
    expect(badge().textContent).toContain("Đang gửi dữ liệu ra ngoài");

    act(() =>
      push({ mode: "local", label: "Chạy cục bộ · dữ liệu không rời máy" }),
    );
    expect(badge().className).not.toMatch(/online|sending/);
  });

  it("gỡ đăng ký sự kiện khi unmount", async () => {
    await act(async () => root.render(createElement(PrivacyBadge)));
    act(() => root.unmount());
    expect(off).toHaveBeenCalled();
    root = createRoot(container);
  });
});
