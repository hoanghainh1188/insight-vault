import { describe, it, expect } from "vitest";
import {
  resampleTo16k,
  TARGET_RATE,
} from "../../src/main/services/ingestion/audio/resample";

describe("resampleTo16k (045)", () => {
  it("srcRate=16000 → trả nguyên (không đổi)", () => {
    const s = new Float32Array([0, 0.5, -0.5, 1]);
    expect(resampleTo16k(s, TARGET_RATE)).toBe(s);
  });

  it("downsample 32000→16000: độ dài ~ giảm nửa", () => {
    const s = new Float32Array(100).map((_, i) => Math.sin(i));
    const out = resampleTo16k(s, 32000);
    expect(out.length).toBe(50);
  });

  it("upsample 8000→16000: độ dài ~ gấp đôi", () => {
    const s = new Float32Array([0, 1, 0, 1, 0]);
    const out = resampleTo16k(s, 8000);
    expect(out.length).toBe(10);
  });

  it("nội suy tuyến tính: giữa 2 mẫu = trung bình", () => {
    // 8000→16000: mẫu mới ở vị trí .5 = trung bình 2 mẫu gốc.
    const out = resampleTo16k(new Float32Array([0, 1]), 8000);
    expect(out[0]).toBeCloseTo(0);
    expect(out[1]).toBeCloseTo(0.5, 5);
  });

  it("rỗng / rate không hợp lệ → Float32Array rỗng", () => {
    expect(resampleTo16k(new Float32Array(0), 44100).length).toBe(0);
    expect(resampleTo16k(new Float32Array([1]), 0).length).toBe(0);
  });
});
