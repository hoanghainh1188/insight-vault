import { Tensor } from "@huggingface/transformers";
import {
  WHISPER_TOKENS,
  detectionWindow,
  pickLanguage,
  probVietnamese,
  requireTokenId,
  type AsrLanguage,
} from "./whisper-language";

// Phát hiện ngôn ngữ một bước decoder {vi, en} (194). Nhận processor/tokenizer/model ĐÃ NẠP — nạp audio truyền
// các phần của pipeline ASR (AutoProcessor + AutoTokenizer + WhisperForConditionalGeneration cùng model) ⇒
// không tải/không giữ weight hai lần; Meeting Capture (186) có thể truyền phần tự `from_pretrained`.

/** Hình dạng tối thiểu dùng tới — khớp các lớp transformers.js, mock được trong unit test. */
export interface WhisperParts {
  processor: (pcm: Float32Array) => Promise<{ input_features: unknown }>;
  tokenizer: { convert_tokens_to_ids: (token: string) => unknown };
  model: (inputs: {
    input_features: unknown;
    decoder_input_ids: unknown;
  }) => Promise<{ logits: { dims: readonly number[]; data: unknown } }>;
}

export interface LanguageDetection {
  lang: AsrLanguage;
  /** P(vi) trên 2 token {vi, en} — để log/ngưỡng tin cậy, KHÔNG phải nội dung. */
  pVi: number;
}

export type LanguageDetector = (
  pcm16k: Float32Array,
) => Promise<LanguageDetection>;

export function createLanguageDetector(parts: WhisperParts): LanguageDetector {
  const id = (token: string): number =>
    requireTokenId(parts.tokenizer.convert_tokens_to_ids(token), token);
  const sot = id(WHISPER_TOKENS.sot);
  const ids = { vi: id(WHISPER_TOKENS.vi), en: id(WHISPER_TOKENS.en) };

  return async (pcm16k) => {
    const { input_features } = await parts.processor(detectionWindow(pcm16k));
    const decoder_input_ids = new Tensor(
      "int64",
      BigInt64Array.from([BigInt(sot)]),
      [1, 1],
    );
    const { logits } = await parts.model({ input_features, decoder_input_ids });
    const pVi = probVietnamese(
      logits.data as ArrayLike<number>,
      logits.dims,
      ids,
    );
    return { lang: pickLanguage(pVi), pVi };
  };
}
