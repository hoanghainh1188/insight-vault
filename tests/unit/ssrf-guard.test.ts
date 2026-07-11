import { describe, it, expect } from "vitest";
import {
  isBlockedIp,
  isBlockedHostname,
  assertSafeUrl,
  assertResolvedIpAllowed,
  SsrfError,
} from "../../src/main/services/ingestion/parsers/ssrf-guard";

describe("ssrf-guard: isBlockedIp", () => {
  it("chặn loopback/private/link-local IPv4", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.5",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.10.10",
      "0.0.0.0",
    ]) {
      expect(isBlockedIp(ip)).toBe(true);
    }
  });

  it("cho phép IPv4 công khai", () => {
    for (const ip of [
      "8.8.8.8",
      "1.1.1.1",
      "172.15.0.1",
      "172.32.0.1",
      "93.184.216.34",
    ]) {
      expect(isBlockedIp(ip)).toBe(false);
    }
  });

  it("chặn IPv6 loopback/unique-local/link-local", () => {
    for (const ip of [
      "::1",
      "::",
      "fc00::1",
      "fd12::34",
      "fe80::1",
      "::ffff:127.0.0.1",
    ]) {
      expect(isBlockedIp(ip)).toBe(true);
    }
  });

  it("chặn IPv4-mapped IPv6 ở DẠNG NÉN hex (chống bypass qua chuẩn hoá URL)", () => {
    // WHATWG URL nén ::ffff:127.0.0.1 → ::ffff:7f00:1; ::ffff:169.254.169.254 → ::ffff:a9fe:a9fe
    expect(isBlockedIp("::ffff:7f00:1")).toBe(true); // 127.0.0.1
    expect(isBlockedIp("::ffff:a9fe:a9fe")).toBe(true); // 169.254.169.254 (metadata)
    expect(isBlockedIp("0:0:0:0:0:ffff:7f00:1")).toBe(true); // dạng mở rộng đầy đủ
    expect(isBlockedIp("::7f00:1")).toBe(true); // IPv4-compatible ::127.0.0.1
  });

  it("cho phép IPv6 công khai", () => {
    expect(isBlockedIp("2001:4860:4860::8888")).toBe(false);
    expect(isBlockedIp("::ffff:8.8.8.8")).toBe(false);
    expect(isBlockedIp("::ffff:808:808")).toBe(false); // 8.8.8.8 dạng nén
  });
});

describe("ssrf-guard: assertSafeUrl chống bypass qua chuẩn hoá URL", () => {
  it("IPv4-mapped IPv6 literal (URL nén) → vẫn chặn", () => {
    expect(() => assertSafeUrl("http://[::ffff:127.0.0.1]/")).toThrow(
      SsrfError,
    );
    expect(() => assertSafeUrl("http://[0:0:0:0:0:ffff:127.0.0.1]/")).toThrow(
      SsrfError,
    );
    expect(() => assertSafeUrl("http://[::ffff:169.254.169.254]/")).toThrow(
      SsrfError,
    );
  });

  it("IPv4 dạng hex/decimal (URL chuẩn hoá về dotted) → chặn", () => {
    expect(() => assertSafeUrl("http://0x7f000001/")).toThrow(SsrfError);
    expect(() => assertSafeUrl("http://2130706433/")).toThrow(SsrfError);
  });

  it("IPv4 dạng rút gọn (URL mở rộng) → chặn", () => {
    expect(() => assertSafeUrl("http://127.1/")).toThrow(SsrfError); // → 127.0.0.1
    expect(() => assertSafeUrl("http://0/")).toThrow(SsrfError); // → 0.0.0.0
    expect(() => assertSafeUrl("http://10.1/")).toThrow(SsrfError); // → 10.0.0.1
  });

  it("host công khai hợp lệ → không ném", () => {
    expect(assertSafeUrl("https://example.com/bai").hostname).toBe(
      "example.com",
    );
    expect(assertSafeUrl("http://8.8.8.8/").hostname).toBe("8.8.8.8");
  });
});

describe("ssrf-guard: isBlockedHostname", () => {
  it("chặn localhost và *.localhost", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("api.localhost")).toBe(true);
    expect(isBlockedHostname("example.com")).toBe(false);
  });
});

describe("ssrf-guard: assertSafeUrl", () => {
  it("cho phép http/https công khai", () => {
    expect(assertSafeUrl("https://example.com/bai").hostname).toBe(
      "example.com",
    );
  });

  it("chặn scheme khác http/https", () => {
    expect(() => assertSafeUrl("file:///etc/passwd")).toThrow(SsrfError);
    expect(() => assertSafeUrl("ftp://x.com")).toThrow(SsrfError);
  });

  it("chặn localhost + IP literal nội bộ", () => {
    expect(() => assertSafeUrl("http://localhost:11434")).toThrow(SsrfError);
    expect(() => assertSafeUrl("http://127.0.0.1/")).toThrow(SsrfError);
    expect(() => assertSafeUrl("http://192.168.0.1/x")).toThrow(SsrfError);
    expect(() => assertSafeUrl("http://[::1]/")).toThrow(SsrfError);
  });

  it("URL rác → SsrfError", () => {
    expect(() => assertSafeUrl("khong-phai-url")).toThrow(SsrfError);
  });
});

describe("ssrf-guard: assertResolvedIpAllowed (mỗi hop sau DNS)", () => {
  it("chặn IP nội bộ, cho IP công khai", () => {
    expect(() => assertResolvedIpAllowed("10.0.0.1")).toThrow(SsrfError);
    expect(() => assertResolvedIpAllowed("8.8.8.8")).not.toThrow();
  });
});
