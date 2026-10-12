import { describe, it, expect } from "vitest";
import {
  matchShortcut,
  shortcutLabel,
  type ShortcutKeyEvent,
} from "../../src/renderer/features/meeting-capture/shortcuts";

// 186 PR C1 (R17, A6) — phím tắt khi app focus: Mod+Shift+P (tạm dừng/tiếp tục), M (đánh dấu), E (kết thúc — chỉ mở hộp xác nhận).
// Mod = Cmd trên macOS, Ctrl trên Windows. THUẦN.

const ev = (over: Partial<ShortcutKeyEvent>): ShortcutKeyEvent => ({
  key: "P",
  code: "KeyP",
  metaKey: false,
  ctrlKey: false,
  shiftKey: true,
  altKey: false,
  repeat: false,
  ...over,
});

describe("matchShortcut", () => {
  it("macOS: Cmd+Shift+P|M|E", () => {
    expect(matchShortcut(ev({ metaKey: true }), "darwin")).toBe("togglePause");
    expect(
      matchShortcut(ev({ metaKey: true, key: "M", code: "KeyM" }), "darwin"),
    ).toBe("mark");
    expect(
      matchShortcut(ev({ metaKey: true, key: "E", code: "KeyE" }), "darwin"),
    ).toBe("end");
  });

  it("Windows: Ctrl+Shift+P|M|E; Cmd không tính trên Windows và ngược lại", () => {
    expect(matchShortcut(ev({ ctrlKey: true }), "win32")).toBe("togglePause");
    expect(matchShortcut(ev({ metaKey: true }), "win32")).toBeNull();
    expect(matchShortcut(ev({ ctrlKey: true }), "darwin")).toBeNull();
  });

  it("thiếu Shift, thêm Alt, hoặc cả Cmd lẫn Ctrl ⇒ không khớp", () => {
    expect(
      matchShortcut(ev({ metaKey: true, shiftKey: false }), "darwin"),
    ).toBeNull();
    expect(
      matchShortcut(ev({ metaKey: true, altKey: true }), "darwin"),
    ).toBeNull();
    expect(
      matchShortcut(ev({ metaKey: true, ctrlKey: true }), "darwin"),
    ).toBeNull();
  });

  it("phím giữ lặp (repeat) ⇒ bỏ qua", () => {
    expect(
      matchShortcut(ev({ metaKey: true, repeat: true }), "darwin"),
    ).toBeNull();
  });

  it("theo vị trí phím (code) — bố cục bàn phím khác vẫn khớp; phím khác ⇒ null", () => {
    expect(
      matchShortcut(ev({ metaKey: true, key: "π", code: "KeyP" }), "darwin"),
    ).toBe("togglePause");
    expect(
      matchShortcut(ev({ metaKey: true, key: "K", code: "KeyK" }), "darwin"),
    ).toBeNull();
  });

  it("không có code (môi trường cũ) ⇒ dùng key, không phân biệt hoa thường", () => {
    expect(
      matchShortcut(ev({ metaKey: true, key: "m", code: "" }), "darwin"),
    ).toBe("mark");
  });

  it("Linux dùng Ctrl như Windows", () => {
    expect(matchShortcut(ev({ ctrlKey: true }), "linux")).toBe("togglePause");
  });
});

describe("shortcutLabel (hiển thị + aria-keyshortcuts)", () => {
  it("mac ⇒ ⌘⇧P / Meta+Shift+P; Windows ⇒ Ctrl+Shift+P / Control+Shift+P", () => {
    expect(shortcutLabel("togglePause", "darwin")).toEqual({
      display: "⌘⇧P",
      aria: "Meta+Shift+P",
    });
    expect(shortcutLabel("end", "win32")).toEqual({
      display: "Ctrl+Shift+E",
      aria: "Control+Shift+E",
    });
  });
});
