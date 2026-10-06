import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// 096 — slim bundle: chỉ loại bản `*.wasm.js` (base64 cho trình duyệt) của tesseract.js-core. Test canh giữ để một
// lần nâng tesseract.js / sửa mẫu loại trừ không làm OCR hỏng ÂM THẦM ở bản đóng gói: MỌI biến thể core `.js` mà
// Node có thể nạp + file `.wasm` nó đọc đều phải còn trong gói.

const require = createRequire(import.meta.url);
const CORE_DIR = dirname(require.resolve("tesseract.js-core/package.json"));
const CORE_PREFIX = "node_modules/tesseract.js-core/";

/** Mẫu loại trừ (`!…`) áp vào tesseract.js-core trong electron-builder.yml (mục `files` chung). */
function exclusions(): string[] {
  const yml = readFileSync(join(process.cwd(), "electron-builder.yml"), "utf8");
  return [
    ...yml.matchAll(/^\s*-\s*"!(node_modules\/tesseract\.js-core\/[^"]+)"/gm),
  ].map((m) => m[1]);
}
/** Glob → RegExp cho cú pháp mẫu đang dùng (`**` qua thư mục, `*` trong 1 đoạn) — không phụ thuộc gói gián tiếp. */
function globToRegExp(glob: string): RegExp {
  const src = glob
    .split("**")
    .map((part) =>
      part
        .split("*")
        .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
        .join("[^/]*"),
    )
    .join(".*");
  return new RegExp(`^${src}$`);
}
const excluded = (file: string): boolean =>
  exclusions().some((p) => globToRegExp(p).test(CORE_PREFIX + file));

const files = readdirSync(CORE_DIR);
const nodeCores = files.filter(
  (f) => /^tesseract-core.*\.js$/.test(f) && !f.endsWith(".wasm.js"),
);

describe("slim bundle tesseract.js-core (096)", () => {
  it("globToRegExp: * không vượt thư mục, ** thì có", () => {
    expect(globToRegExp("a/*.wasm.js").test("a/x.wasm.js")).toBe(true);
    expect(globToRegExp("a/*.wasm.js").test("a/b/x.wasm.js")).toBe(false);
    expect(globToRegExp("a/*.wasm.js").test("a/x.wasm")).toBe(false);
    expect(globToRegExp("a/**").test("a/b/c.js")).toBe(true);
  });

  it("có mẫu loại trừ cho tesseract.js-core", () => {
    expect(exclusions().length).toBeGreaterThan(0);
  });

  it("MỌI biến thể core cho Node (.js) + file .wasm nó đọc đều KHÔNG bị loại", () => {
    expect(nodeCores.length).toBeGreaterThanOrEqual(6);
    for (const js of nodeCores) {
      expect(excluded(js), js).toBe(false);
      const src = readFileSync(join(CORE_DIR, js), "utf8");
      const wasm = [
        ...new Set(src.match(/tesseract-core[a-z-]*\.wasm(?!\.js)\b/g) ?? []),
      ];
      expect(wasm.length, `${js} phải tham chiếu .wasm`).toBeGreaterThan(0);
      for (const w of wasm) expect(excluded(w), w).toBe(false);
    }
  });

  it("biến thể Node THỰC SỰ nạp (getCore của tesseract.js) không bị loại", async () => {
    const getCore =
      require("tesseract.js/src/worker-script/node/getCore.js") as (
        oem: unknown,
        p: unknown,
        res: { progress: () => void },
      ) => Promise<unknown>;
    await getCore(true, null, { progress: () => undefined });
    const loaded = Object.keys(require.cache)
      .filter((k) => k.startsWith(CORE_DIR))
      .map((k) => k.slice(CORE_DIR.length + 1));
    expect(loaded.length).toBeGreaterThan(0);
    for (const f of loaded) expect(excluded(f), f).toBe(false);
  });

  it("toàn bộ bản *.wasm.js (chỉ dành cho trình duyệt) bị loại", () => {
    const browserOnly = files.filter((f) => f.endsWith(".wasm.js"));
    expect(browserOnly.length).toBeGreaterThan(0);
    for (const f of browserOnly) expect(excluded(f), f).toBe(true);
  });
});
