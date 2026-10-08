import { intlLocaleOf, SOURCE_LANGUAGE, type LanguageCode } from "./languages";
import { vi } from "./vi";
import { en } from "./en";

// 123 — khung dịch tự viết, có kiểu (research R2, contracts/i18n-core.md). Thuần: chỉ dùng Intl.PluralRules.
// Nội suy chỉ thay {name} bằng String(value) — KHÔNG diễn giải HTML (FR-025); nơi hiển thị dùng text node.

export interface PluralLeaf {
  readonly one: string;
  readonly other: string;
}
export type Leaf = string | PluralLeaf;
export interface Catalog {
  readonly [key: string]: Leaf | Catalog;
}
export type Params = Readonly<Record<string, string | number>>;

/** Cấu trúc tệp dịch: cùng khoá với vi.ts, lá là string / {one, other}. en.ts phải khớp kiểu này. */
export type Messages = Widen<typeof vi>;
type Widen<T> = T extends string
  ? string
  : T extends PluralLeaf
    ? PluralLeaf
    : { readonly [K in keyof T]: Widen<T[K]> };

type IsPlural<T> = T extends { readonly one: string; readonly other: string }
  ? true
  : false;
type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : IsPlural<T[K]> extends true
      ? `${P}${K}`
      : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
type PluralPaths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? never
    : IsPlural<T[K]> extends true
      ? `${P}${K}`
      : PluralPaths<T[K], `${P}${K}.`>;
}[keyof T & string];
type LeafAt<T, K extends string> = K extends `${infer H}.${infer R}`
  ? H extends keyof T
    ? LeafAt<T[H], R>
    : never
  : K extends keyof T
    ? T[K]
    : never;
type Placeholders<S> = S extends `${string}{${infer P}}${infer R}`
  ? P | Placeholders<R>
  : never;
type LeafText<L> = L extends string
  ? L
  : L extends { readonly one: infer O; readonly other: infer X }
    ? O | X
    : never;

export type MessageKey = Paths<typeof vi>;
export type PluralKey = PluralPaths<typeof vi>;
export type ParamsOf<K extends MessageKey> = {
  readonly [
    P in Exclude<Placeholders<LeafText<LeafAt<typeof vi, K>>>, "count">
  ]: string | number;
};
type ParamArgs<K extends MessageKey> = [keyof ParamsOf<K>] extends [never]
  ? []
  : [ParamsOf<K>];

export interface Translator {
  readonly lang: LanguageCode;
  t<K extends MessageKey>(key: K, ...params: ParamArgs<K>): string;
  plural<K extends PluralKey>(
    key: K,
    count: number,
    ...params: ParamArgs<K>
  ): string;
}

/** Bản không kiểu (catalog tiêm vào) — dùng cho test và làm lõi cho createTranslator. */
export interface UntypedTranslator {
  readonly lang: string;
  t(key: string, params?: Params): string;
  plural(key: string, count: number, params?: Params): string;
}

function lookup(catalog: Catalog | undefined, key: string): Leaf | undefined {
  let node: Leaf | Catalog | undefined = catalog;
  for (const part of key.split(".")) {
    if (node === undefined || typeof node === "string") return undefined;
    node = (node as Catalog)[part];
  }
  if (typeof node === "string") return node;
  if (node && isPlural(node)) return node;
  return undefined;
}

function isPlural(node: Leaf | Catalog): node is PluralLeaf {
  return (
    typeof node === "object" &&
    typeof (node as PluralLeaf).one === "string" &&
    typeof (node as PluralLeaf).other === "string" &&
    Object.keys(node).length === 2
  );
}

function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{([A-Za-z0-9_]+)\}/g, (m, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name])
      : m,
  );
}

export function createTranslatorFrom(
  catalogs: Readonly<Record<string, Catalog>>,
  lang: string,
  intlLocale: string = lang,
): UntypedTranslator {
  const rules = new Intl.PluralRules(intlLocale);
  const find = (key: string): Leaf | undefined =>
    lookup(catalogs[lang], key) ?? lookup(catalogs[SOURCE_LANGUAGE], key);
  return {
    lang,
    t(key, params) {
      const leaf = find(key);
      if (leaf === undefined) return key;
      return interpolate(typeof leaf === "string" ? leaf : leaf.other, params);
    },
    plural(key, count, params) {
      const leaf = find(key);
      if (leaf === undefined) return key;
      const text =
        typeof leaf === "string"
          ? leaf
          : rules.select(count) === "one"
            ? leaf.one
            : leaf.other;
      return interpolate(text, { ...params, count });
    },
  };
}

const CATALOGS: Readonly<Record<LanguageCode, Catalog>> = { vi, en };
const cache = new Map<LanguageCode, Translator>();

/** Translator có kiểu cho ngôn ngữ giao diện (cache theo ngôn ngữ). */
export function createTranslator(lang: LanguageCode): Translator {
  const hit = cache.get(lang);
  if (hit) return hit;
  const core = createTranslatorFrom(CATALOGS, lang, intlLocaleOf(lang));
  const tr: Translator = {
    lang,
    t: (key: string, ...p: unknown[]) => core.t(key, p[0] as Params),
    plural: (key: string, count: number, ...p: unknown[]) =>
      core.plural(key, count, p[0] as Params),
  } as Translator;
  cache.set(lang, tr);
  return tr;
}

export const CATALOG_BY_LANGUAGE = CATALOGS;
