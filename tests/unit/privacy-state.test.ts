import { describe, it, expect } from "vitest";
import {
  getPrivacyState,
  labelForMode,
} from "../../src/main/services/app-shell/privacy-state";

describe("privacy-state", () => {
  it("v1 luôn ở chế độ local", () => {
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
