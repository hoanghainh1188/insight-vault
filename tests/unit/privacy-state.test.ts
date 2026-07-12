import { describe, it, expect, afterEach } from "vitest";
import {
  getPrivacyState,
  labelForMode,
  setOnlineProviderActive,
} from "../../src/main/services/app-shell/privacy-state";

describe("privacy-state", () => {
  afterEach(() => setOnlineProviderActive(false)); // reset singleton

  it("mặc định ở chế độ local", () => {
    expect(getPrivacyState().mode).toBe("local");
  });

  it("provider online active → mode online (031)", () => {
    setOnlineProviderActive(true);
    expect(getPrivacyState().mode).toBe("online");
    expect(getPrivacyState().label).toContain("online");
    setOnlineProviderActive(false);
    expect(getPrivacyState().mode).toBe("local");
  });

  it("label suy ra từ mode, khớp labelForMode", () => {
    const s = getPrivacyState();
    expect(s.label).toBe(labelForMode("local"));
    expect(s.label).toContain("cục bộ");
  });

  it("label local và online khác nhau", () => {
    expect(labelForMode("local")).not.toBe(labelForMode("online"));
    expect(labelForMode("online")).toContain("online");
  });
});
