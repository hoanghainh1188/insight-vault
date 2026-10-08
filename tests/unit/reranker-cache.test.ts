import { describe, it, expect } from "vitest";
import { join } from "node:path";
import {
  isRerankerCached,
  rerankerCacheFiles,
} from "../../src/main/services/rerank/cache";

// 153: phân biệt "nạp từ cache" với "tải lần đầu" — cache đủ khi CÓ ĐỦ các tệp transformers.js cần cho model + revision + tệp ONNX
// (bố cục <cacheDir>/<model>/<revision>/…). Thiếu một tệp ⇒ coi như chưa có (sẽ tải ⇒ có egress).

const DIR = "/data/models";
const MODEL = "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1";
const REV = "1427fd652930e4ba29e8149678df786c240d8825";

describe("rerankerCacheFiles", () => {
  it("liệt kê config, tokenizer và tệp ONNX theo kiến trúc dưới thư mục revision", () => {
    const base = join(DIR, MODEL, REV);
    expect(rerankerCacheFiles(DIR, MODEL, REV, "model_qint8_arm64")).toEqual([
      join(base, "config.json"),
      join(base, "tokenizer.json"),
      join(base, "tokenizer_config.json"),
      join(base, "onnx", "model_qint8_arm64.onnx"),
    ]);
  });
});

describe("isRerankerCached", () => {
  const files = rerankerCacheFiles(DIR, MODEL, REV, "model_quint8_avx2");
  it("đủ mọi tệp ⇒ true", () => {
    expect(isRerankerCached(files, () => true)).toBe(true);
  });
  it("thiếu một tệp (vd ONNX của kiến trúc khác / tải dở) ⇒ false", () => {
    const missing = files[3];
    expect(isRerankerCached(files, (p) => p !== missing)).toBe(false);
  });
  it("hàm kiểm tra ném lỗi ⇒ false (an toàn: coi như sẽ tải, bật chỉ báo)", () => {
    expect(
      isRerankerCached(files, () => {
        throw new Error("EACCES");
      }),
    ).toBe(false);
  });
});
