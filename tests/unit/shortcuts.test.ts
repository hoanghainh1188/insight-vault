import { describe, it, expect } from "vitest";
import {
  matchShortcut,
  keyLabel,
  SHORTCUTS,
  type KeyLike,
} from "../../src/renderer/shared/shortcuts";

const ev = (over: Partial<KeyLike>): KeyLike => ({
  key: "",
  metaKey: false,
  ctrlKey: false,
  inField: false,
  ...over,
});

describe("matchShortcut (043)", () => {
  it("Cmd/Ctrl+N → new-notebook (cả khi đang gõ)", () => {
    expect(matchShortcut(ev({ key: "n", metaKey: true }))).toBe("new-notebook");
    expect(matchShortcut(ev({ key: "N", ctrlKey: true }))).toBe("new-notebook");
    expect(matchShortcut(ev({ key: "n", metaKey: true, inField: true }))).toBe(
      "new-notebook",
    );
  });

  it("Cmd/Ctrl+K → focus-search", () => {
    expect(matchShortcut(ev({ key: "k", metaKey: true }))).toBe("focus-search");
    expect(matchShortcut(ev({ key: "K", ctrlKey: true }))).toBe("focus-search");
  });

  it('"?" → help CHỈ khi không ở ô nhập', () => {
    expect(matchShortcut(ev({ key: "?" }))).toBe("help");
    expect(matchShortcut(ev({ key: "?", inField: true }))).toBeNull();
  });

  it("phím thường / không modifier → null", () => {
    expect(matchShortcut(ev({ key: "n" }))).toBeNull();
    expect(matchShortcut(ev({ key: "a", metaKey: true }))).toBeNull();
    expect(matchShortcut(ev({ key: "Enter" }))).toBeNull();
  });
});

describe("keyLabel + SHORTCUTS (043)", () => {
  it("$mod → ⌘ (mac) / Ctrl (khác)", () => {
    expect(keyLabel("$mod", true)).toBe("⌘");
    expect(keyLabel("$mod", false)).toBe("Ctrl");
    expect(keyLabel("N", true)).toBe("N");
  });
  it("bảng phím tắt có mục N, K, ?", () => {
    const flat = SHORTCUTS.flatMap((s) => s.keys);
    expect(flat).toContain("N");
    expect(flat).toContain("K");
    expect(flat).toContain("?");
  });
});
