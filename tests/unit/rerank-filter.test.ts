import { describe, it, expect } from "vitest";
import {
  applyRerank,
  validateRerankConfig,
  type RerankConfig,
} from "../../src/main/services/rag/rerank-filter";

// 109 (contracts/rerank-filter.md): quyết định đoạn nào giữ lại sau khi bộ chấm độ liên quan cho điểm — hàm THUẦN dùng chung
// retrieve() (app) và công cụ đo. Chỉ chọn/sắp id; không đổi chunk/locator (Constitution II).

const cfg = (over: Partial<RerankConfig> = {}): RerankConfig => ({
  minScore: 0.5,
  relativeDelta: null,
  reorder: false,
  timeoutMs: 1500,
  ...over,
});
const scores = (o: Record<string, number>) => new Map(Object.entries(o));

describe("applyRerank", () => {
  it("ngưỡng tuyệt đối: giữ điểm ≥ minScore, giữ thứ tự RRF", () => {
    const r = applyRerank(
      ["a", "b", "c", "d"],
      scores({ a: 0.2, b: 0.9, c: 0.5, d: 0.49 }),
      cfg(),
    );
    expect(r.ids).toEqual(["b", "c"]);
    expect([...r.scoreOf]).toEqual([
      ["b", 0.9],
      ["c", 0.5],
    ]);
  });

  it("ngưỡng tương đối: giữ điểm ≥ best − delta (kết hợp với tuyệt đối)", () => {
    const s = scores({ a: 0.95, b: 0.8, c: 0.6, d: 0.3 });
    expect(
      applyRerank(
        ["a", "b", "c", "d"],
        s,
        cfg({ minScore: 0, relativeDelta: 0.2 }),
      ).ids,
    ).toEqual(["a", "b"]);
    expect(
      applyRerank(
        ["a", "b", "c", "d"],
        s,
        cfg({ minScore: 0.85, relativeDelta: 0.5 }),
      ).ids,
    ).toEqual(["a"]);
  });

  it("reorder: sắp điểm giảm dần, hoà giữ thứ tự RRF", () => {
    const r = applyRerank(
      ["a", "b", "c", "d"],
      scores({ a: 0.6, b: 0.9, c: 0.9, d: 0.7 }),
      cfg({ minScore: 0, reorder: true }),
    );
    expect(r.ids).toEqual(["b", "c", "d", "a"]);
  });

  it("id thiếu điểm bị loại; không id nào có điểm ⇒ rỗng", () => {
    expect(
      applyRerank(["a", "b"], scores({ b: 0.9 }), cfg({ minScore: 0 })).ids,
    ).toEqual(["b"]);
    const empty = applyRerank(["a", "b"], new Map(), cfg({ minScore: 0 }));
    expect(empty.ids).toEqual([]);
    expect(empty.scoreOf.size).toBe(0);
  });

  it("không đoạn nào đạt ⇒ rỗng (→ không tìm thấy)", () => {
    expect(
      applyRerank(["a", "b"], scores({ a: 0.1, b: 0.2 }), cfg()).ids,
    ).toEqual([]);
  });

  it("không mutate đầu vào; ids ⊆ fused (bỏ điểm của id ngoài fused)", () => {
    const fused = ["a", "b"];
    const s = scores({ a: 0.9, b: 0.8, x: 1 });
    const r = applyRerank(fused, s, cfg({ minScore: 0, reorder: true }));
    expect(fused).toEqual(["a", "b"]);
    expect(s.size).toBe(3);
    expect(r.ids).toEqual(["a", "b"]);
    expect(r.scoreOf.has("x")).toBe(false);
  });

  it("tất định: cùng đầu vào ⇒ cùng kết quả", () => {
    const run = () =>
      applyRerank(
        ["a", "b", "c"],
        scores({ a: 0.7, b: 0.7, c: 0.9 }),
        cfg({ minScore: 0.6, reorder: true }),
      ).ids;
    expect(run()).toEqual(run());
  });
});

describe("validateRerankConfig", () => {
  it("cấu hình hợp lệ không ném", () => {
    expect(() => validateRerankConfig(cfg())).not.toThrow();
    expect(() =>
      validateRerankConfig(cfg({ minScore: 0, relativeDelta: 1 })),
    ).not.toThrow();
  });

  it("ngoài miền ⇒ ném", () => {
    for (const bad of [
      cfg({ minScore: -0.1 }),
      cfg({ minScore: 1.1 }),
      cfg({ minScore: Number.NaN }),
      cfg({ relativeDelta: -0.1 }),
      cfg({ relativeDelta: 2 }),
      cfg({ timeoutMs: 0 }),
      cfg({ timeoutMs: Number.POSITIVE_INFINITY }),
    ]) {
      expect(() => validateRerankConfig(bad), JSON.stringify(bad)).toThrow();
    }
  });
});
