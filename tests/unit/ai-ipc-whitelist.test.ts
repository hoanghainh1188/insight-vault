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
  it("tổng whitelist = 10 (5 app + 5 ai)", () => {
    expect(WHITELISTED_CHANNELS.size).toBe(10);
    expect(Object.values(CHANNELS)).toHaveLength(10);
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
