import { describe, it, expect } from "vitest";
import {
  CHANNELS,
  WHITELISTED_CHANNELS,
  isWhitelisted,
} from "../../src/shared/ipc/channels";

const APP_CHANNELS = [
  "app:getDataDir",
  "app:getStorageInfo",
  "app:getPrivacyState",
  "app:getOnboardingState",
  "app:setOnboardingComplete",
  "app:getAppInfo",
];

describe("ipc whitelist", () => {
  it("5 kênh app-shell đều whitelisted (feature sau thêm kênh — không cứng tổng số)", () => {
    for (const ch of APP_CHANNELS) expect(isWhitelisted(ch)).toBe(true);
    expect(WHITELISTED_CHANNELS.size).toBeGreaterThanOrEqual(
      APP_CHANNELS.length,
    );
  });

  it("mọi kênh trong CHANNELS đều whitelisted (nguồn duy nhất)", () => {
    for (const ch of Object.values(CHANNELS)) {
      expect(isWhitelisted(ch)).toBe(true);
    }
  });

  it("kênh ngoài danh sách bị từ chối", () => {
    expect(isWhitelisted("app:readFile")).toBe(false);
    expect(isWhitelisted("fs:writeAnything")).toBe(false);
    expect(isWhitelisted("")).toBe(false);
  });
});
