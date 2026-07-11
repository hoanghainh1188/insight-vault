import { describe, it, expect } from "vitest";
import {
  CHANNELS,
  WHITELISTED_CHANNELS,
  isWhitelisted,
} from "../../src/shared/ipc/channels";

const AI_CHANNELS = [
  "ai:listModels",
  "ai:testConnection",
  "ai:getSelectedModels",
  "ai:setSelectedModels",
  "ai:getRuntimeStatus",
];

describe("ai IPC whitelist", () => {
  it("có ≥ 10 kênh (5 app + 5 ai; feature sau thêm — không cứng tổng)", () => {
    expect(WHITELISTED_CHANNELS.size).toBeGreaterThanOrEqual(10);
    expect(new Set(Object.values(CHANNELS)).size).toBe(
      Object.values(CHANNELS).length,
    );
  });

  it("5 kênh ai:* đều whitelisted", () => {
    for (const ch of AI_CHANNELS) expect(isWhitelisted(ch)).toBe(true);
  });

  it("kênh ai:* ngoài danh sách bị từ chối", () => {
    expect(isWhitelisted("ai:pullModel")).toBe(false);
    expect(isWhitelisted("ai:deleteModel")).toBe(false);
    expect(isWhitelisted("ai:rawFetch")).toBe(false);
  });

  it("không đổi 5 kênh app:*", () => {
    for (const ch of [
      "app:getDataDir",
      "app:getPrivacyState",
      "app:getOnboardingState",
      "app:setOnboardingComplete",
      "app:getAppInfo",
    ]) {
      expect(isWhitelisted(ch)).toBe(true);
    }
  });
});
