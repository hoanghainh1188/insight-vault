import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { VI_LITERAL_ALLOWLIST } from "./i18n-allowlist";

// 123 (FR-011, SC-002): không còn chuỗi tiếng Việt viết cứng trong src/ ngoài tệp dịch. Quét literal ("…", '…',
// `…`) và chữ JSX giữa thẻ; bỏ chú thích. Tệp dịch (src/shared/i18n/vi.ts, domains/*) và allowlist có lý do được miễn.

const ROOT = join(__dirname, "..", "..");
const VI =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const STR = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;
const JSX_TEXT = />([^<>{}\n]*[A-Za-zÀ-ỹ][^<>{}\n]*)</g;

function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listSources(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Trả danh sách vi phạm "tệp:dòng: chuỗi" trong một mã nguồn. */
export function findViLiterals(file: string, src: string): string[] {
  const code = stripComments(src);
  const hits: string[] = [];
  for (const re of [STR, JSX_TEXT]) {
    for (const m of code.matchAll(re)) {
      if (!VI.test(m[0])) continue;
      const line = code.slice(0, m.index).split("\n").length;
      hits.push(`${file}:${line}: ${m[0].slice(0, 80)}`);
    }
  }
  return hits;
}

const EXEMPT = (rel: string): boolean =>
  rel === "src/shared/i18n/vi.ts" ||
  rel.startsWith("src/shared/i18n/domains/") ||
  VI_LITERAL_ALLOWLIST.some((a) => a.file === rel);

describe("không có chuỗi tiếng Việt viết cứng ngoài tệp dịch", () => {
  it("src/**/*.ts(x)", () => {
    const violations = listSources(join(ROOT, "src"))
      .map((p) => relative(ROOT, p).split("\\").join("/"))
      .filter((rel) => !EXEMPT(rel))
      .flatMap((rel) =>
        findViLiterals(rel, readFileSync(join(ROOT, rel), "utf8")),
      );
    expect(violations).toEqual([]);
  });

  it("tự kiểm: bộ quét bắt được chuỗi cứng (literal, template, JSX) và bỏ qua chú thích", () => {
    const sample = [
      'const a = "Xin chào";',
      "const b = `Đang tải ${x}`;",
      "const c = <p>Lưu lại</p>;",
      "// chú thích tiếng Việt không tính",
      "/* khối chú thích: Đã xong */",
      'const ok = "Hello";',
    ].join("\n");
    const hits = findViLiterals("x.tsx", sample);
    expect(hits).toHaveLength(3);
    expect(hits[0]).toContain("x.tsx:1");
  });

  it("allowlist chỉ chứa tệp tồn tại, có lý do", () => {
    for (const a of VI_LITERAL_ALLOWLIST) {
      expect(statSync(join(ROOT, a.file)).isFile()).toBe(true);
      expect(a.reason.length).toBeGreaterThan(10);
    }
  });
});
