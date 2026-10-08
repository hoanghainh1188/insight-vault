import { describe, it, expect } from "vitest";
import { vi } from "../../src/shared/i18n/vi";
import { en } from "../../src/shared/i18n/en";
import { LANGUAGES } from "../../src/shared/i18n/languages";
import {
  CATALOG_BY_LANGUAGE,
  type Catalog,
  type Leaf,
} from "../../src/shared/i18n/translate";

// 123 (FR-010, SC-002): mọi ngôn ngữ cùng tập khoá lá, cùng placeholder, plural đủ one/other, không rỗng, không HTML.

type Flat = Map<string, Leaf>;

function flatten(node: Catalog, prefix = "", out: Flat = new Map()): Flat {
  for (const [k, v] of Object.entries(node)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else if (isPluralLeaf(v)) out.set(key, v);
    else flatten(v as Catalog, key, out);
  }
  return out;
}

function isPluralLeaf(v: unknown): v is { one: string; other: string } {
  return (
    typeof v === "object" &&
    v !== null &&
    Object.keys(v).length === 2 &&
    typeof (v as { one?: unknown }).one === "string" &&
    typeof (v as { other?: unknown }).other === "string"
  );
}

function placeholders(leaf: Leaf): string[] {
  const texts = typeof leaf === "string" ? [leaf] : [leaf.one, leaf.other];
  const set = new Set<string>();
  for (const t of texts) {
    for (const m of t.matchAll(/\{([A-Za-z0-9_]+)\}/g)) set.add(m[1]);
  }
  set.delete("count");
  return [...set].sort();
}

const flatVi = flatten(vi as unknown as Catalog);
const flatEn = flatten(en as unknown as Catalog);

describe("tệp dịch", () => {
  it("mọi ngôn ngữ trong LANGUAGES có catalog", () => {
    for (const l of LANGUAGES)
      expect(CATALOG_BY_LANGUAGE[l.code]).toBeDefined();
  });

  it("tập khoá lá vi = en", () => {
    expect([...flatEn.keys()].sort()).toEqual([...flatVi.keys()].sort());
  });

  it("cùng tập placeholder và cùng dạng (chuỗi/plural) cho mỗi khoá", () => {
    for (const [key, leafVi] of flatVi) {
      const leafEn = flatEn.get(key)!;
      expect(typeof leafEn, key).toBe(typeof leafVi);
      expect(placeholders(leafEn), key).toEqual(placeholders(leafVi));
    }
  });

  it("không chuỗi rỗng, không ký tự HTML '<'", () => {
    for (const flat of [flatVi, flatEn]) {
      for (const [key, leaf] of flat) {
        const texts =
          typeof leaf === "string" ? [leaf] : [leaf.one, leaf.other];
        for (const t of texts) {
          expect(t.trim().length, key).toBeGreaterThan(0);
          expect(t.includes("<"), key).toBe(false);
        }
      }
    }
  });

  it("bản English không còn ký tự tiếng Việt có dấu", () => {
    const VI =
      /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
    for (const [key, leaf] of flatEn) {
      const texts = typeof leaf === "string" ? [leaf] : [leaf.one, leaf.other];
      // Ngoại lệ có chủ đích: tên tự xưng "Tiếng Việt" (FR-003) nằm ở languages.ts, không ở catalog.
      for (const t of texts) expect(VI.test(t), `${key}: ${t}`).toBe(false);
    }
  });
});
