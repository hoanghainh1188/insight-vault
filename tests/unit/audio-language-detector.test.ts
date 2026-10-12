import { describe, it, expect, vi } from "vitest";

// 194 — bộ phát hiện ngôn ngữ một bước decoder, chạy trên các phần processor/tokenizer/model GIẢ (không tải
// transformers.js thật). Tensor được mock thành bản ghi {type, data, dims} để kiểm decoder_input_ids.
vi.mock("@huggingface/transformers", () => ({
  Tensor: class {
    constructor(
      public type: string,
      public data: BigInt64Array,
      public dims: number[],
    ) {}
  },
}));

const { createLanguageDetector } =
  await import("../../src/main/services/ingestion/audio/language-detector");

const TOKENS: Record<string, number> = {
  "<|startoftranscript|>": 0,
  "<|vi|>": 1,
  "<|en|>": 2,
};

function fakeParts(lastLogits: { vi: number; en: number }) {
  const processor = vi.fn(async (pcm: Float32Array) => ({
    input_features: { len: pcm.length },
  }));
  const model = vi.fn(async (_inputs: object) => ({
    logits: {
      dims: [1, 1, 3],
      data: new Float32Array([0, lastLogits.vi, lastLogits.en]),
    },
  }));
  const tokenizer = {
    convert_tokens_to_ids: vi.fn((t: string): number | undefined => TOKENS[t]),
  };
  return { processor, tokenizer, model };
}

describe("createLanguageDetector (194)", () => {
  it("logit <|vi|> trội ⇒ vi, kèm P(vi)", async () => {
    const detect = createLanguageDetector(fakeParts({ vi: 6, en: 1 }));
    const r = await detect(new Float32Array(16000 * 5));
    expect(r.lang).toBe("vi");
    expect(r.pVi).toBeGreaterThan(0.99);
  });

  it("logit <|en|> trội ⇒ en", async () => {
    const detect = createLanguageDetector(fakeParts({ vi: -2, en: 3 }));
    expect((await detect(new Float32Array(16000))).lang).toBe("en");
  });

  it("chỉ đưa 30 s đầu vào processor + MỘT bước decoder bắt đầu bằng <|startoftranscript|>", async () => {
    const parts = fakeParts({ vi: 1, en: 0 });
    const detect = createLanguageDetector(parts);
    await detect(new Float32Array(16000 * 90));
    expect(parts.processor.mock.calls[0]?.[0].length).toBe(16000 * 30);
    expect(parts.model).toHaveBeenCalledTimes(1);
    const inputs = parts.model.mock.calls[0]?.[0] as {
      input_features: unknown;
      decoder_input_ids: { type: string; data: BigInt64Array; dims: number[] };
    };
    expect(inputs.input_features).toEqual({ len: 16000 * 30 });
    expect(inputs.decoder_input_ids.type).toBe("int64");
    expect(Array.from(inputs.decoder_input_ids.data)).toEqual([0n]);
    expect(inputs.decoder_input_ids.dims).toEqual([1, 1]);
  });

  it("tra id token một lần khi tạo (không tra lại mỗi lần detect)", async () => {
    const parts = fakeParts({ vi: 1, en: 0 });
    const detect = createLanguageDetector(parts);
    await detect(new Float32Array(10));
    await detect(new Float32Array(10));
    expect(parts.tokenizer.convert_tokens_to_ids).toHaveBeenCalledTimes(3);
  });

  it("tokenizer thiếu token ngôn ngữ ⇒ lỗi ngay khi tạo", () => {
    const parts = fakeParts({ vi: 0, en: 0 });
    parts.tokenizer.convert_tokens_to_ids = vi.fn((t: string) =>
      t === "<|vi|>" ? undefined : TOKENS[t],
    );
    expect(() => createLanguageDetector(parts)).toThrow(/<\|vi\|>/);
  });
});
