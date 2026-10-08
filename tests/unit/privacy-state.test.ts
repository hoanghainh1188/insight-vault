import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getPrivacyState,
  onPrivacyChange,
  setEgressActive,
  setOnlineProviderActive,
  withEgress,
} from "../../src/main/services/app-shell/privacy-state";

// 103 — badge 3 trạng thái (ADR 2026-10-07-privacy-badge-clarify): local / online (đã bật, chưa gửi) /
// sending (đang có egress thật, ưu tiên cao nhất). Main đẩy sự kiện khi mode đổi.

describe("privacy-state", () => {
  afterEach(() => {
    setOnlineProviderActive(false); // reset singleton
    // xả hết egress còn treo
    for (const k of ["ai", "url", "model"] as const)
      for (let i = 0; i < 10; i++) setEgressActive(false, k);
  });

  it("mặc định ở chế độ local", () => {
    expect(getPrivacyState().mode).toBe("local");
  });

  it("provider online active → mode online (031) — 'chỉ gửi khi bạn hỏi'", () => {
    setOnlineProviderActive(true);
    expect(getPrivacyState()).toEqual({ mode: "online" });
    setOnlineProviderActive(false);
    expect(getPrivacyState().mode).toBe("local");
  });

  it("đang có egress → sending (ưu tiên hơn online), đếm chồng an toàn", () => {
    setOnlineProviderActive(true);
    setEgressActive(true);
    setEgressActive(true);
    expect(getPrivacyState().mode).toBe("sending");
    setEgressActive(false);
    expect(getPrivacyState().mode).toBe("sending");
    setEgressActive(false);
    expect(getPrivacyState().mode).toBe("online");
    setEgressActive(false); // không âm
    expect(getPrivacyState().mode).toBe("online");
  });

  it("123: sending kèm egressKind theo ưu tiên ai > url > model; không còn nhãn chữ từ main", () => {
    setEgressActive(true, "model");
    expect(getPrivacyState()).toEqual({ mode: "sending", egressKind: "model" });
    setEgressActive(true, "url");
    expect(getPrivacyState()).toEqual({ mode: "sending", egressKind: "url" });
    setEgressActive(true, "ai");
    expect(getPrivacyState()).toEqual({ mode: "sending", egressKind: "ai" });
    expect("label" in getPrivacyState()).toBe(false);
  });

  it("listener chỉ được gọi khi MODE đổi", () => {
    const fn = vi.fn();
    const off = onPrivacyChange(fn);
    setEgressActive(true); // local → sending
    setEgressActive(true); // vẫn sending ⇒ không gọi
    setEgressActive(false);
    setEgressActive(false); // sending → local
    setOnlineProviderActive(true); // local → online
    setOnlineProviderActive(true); // không đổi
    off();
    setOnlineProviderActive(false); // đã huỷ đăng ký
    expect(fn.mock.calls.map((c) => c[0].mode)).toEqual([
      "sending",
      "local",
      "online",
    ]);
  });

  it("withEgress: sending trong lúc chạy, trở về sau khi xong — kể cả khi ném lỗi", async () => {
    let during = "";
    await withEgress(async () => {
      during = getPrivacyState().mode;
    });
    expect(during).toBe("sending");
    expect(getPrivacyState().mode).toBe("local");
    await expect(
      withEgress(async () => {
        throw new Error("x");
      }),
    ).rejects.toThrow("x");
    expect(getPrivacyState().mode).toBe("local");
  });
});
