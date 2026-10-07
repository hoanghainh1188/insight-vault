import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getPrivacyState,
  labelForMode,
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
    expect(getPrivacyState()).toEqual({
      mode: "online",
      label: labelForMode("online"),
    });
    expect(labelForMode("online")).toContain("chỉ gửi khi bạn hỏi");
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

  it("3 nhãn khác nhau; local nói 'cục bộ', sending nói 'đang gửi'", () => {
    const labels = new Set(
      ["local", "online", "sending"].map((m) => labelForMode(m as never)),
    );
    expect(labels.size).toBe(3);
    expect(labelForMode("local")).toContain("cục bộ");
    expect(labelForMode("sending")).toContain("Đang gửi");
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
