import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectLicenses } from "../../src/main/services/app-shell/about-licenses";

// 213: danh sách thư viện từ dữ liệu build (package.json của từng gói) — không gõ tay (SC-003).

describe("collectLicenses", () => {
  it("lấy version + license (chuỗi, {type}, mảng licenses); thiếu ⇒ license null; sắp theo tên không phân biệt hoa thường", () => {
    const pkgs: Record<string, unknown> = {
      zod: { version: "3.0.0", license: "MIT" },
      Alpha: { version: "1.2.3", license: { type: "Apache-2.0" } },
      beta: { version: "2.0.0", licenses: [{ type: "MIT" }, { type: "ISC" }] },
      gamma: { version: "0.1.0" },
    };
    const out = collectLicenses(Object.keys(pkgs), (n) => pkgs[n]);
    expect(out).toEqual([
      { name: "Alpha", version: "1.2.3", license: "Apache-2.0" },
      { name: "beta", version: "2.0.0", license: "MIT OR ISC" },
      { name: "gamma", version: "0.1.0", license: null },
      { name: "zod", version: "3.0.0", license: "MIT" },
    ]);
  });

  it("gói không đọc được ⇒ vẫn có mặt với version '?' (không làm hỏng danh sách)", () => {
    const out = collectLicenses(["ok", "bad"], (n) => {
      if (n === "bad") throw new Error("ENOENT");
      return { version: "1.0.0", license: "MIT" };
    });
    expect(out).toEqual([
      { name: "bad", version: "?", license: null },
      { name: "ok", version: "1.0.0", license: "MIT" },
    ]);
  });

  it("trên repo thật: đúng tập dependencies của package.json (không thiếu, không dư)", () => {
    const root = resolve(__dirname, "../..");
    const deps = Object.keys(
      (
        JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
          dependencies: Record<string, string>;
        }
      ).dependencies,
    );
    const out = collectLicenses(deps, (n) =>
      JSON.parse(
        readFileSync(resolve(root, "node_modules", n, "package.json"), "utf8"),
      ),
    );
    expect(out.map((l) => l.name).sort()).toEqual([...deps].sort());
    expect(out.every((l) => l.version !== "?")).toBe(true);
  });
});
