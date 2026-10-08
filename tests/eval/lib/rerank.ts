import { performance } from "node:perf_hooks";
import {
  AutoModel,
  AutoModelForSequenceClassification,
  AutoTokenizer,
  env,
} from "@huggingface/transformers";

// 109 (research R1–R3, R11): nạp bộ chấm độ liên quan (cross-encoder) trong công cụ đo + đo độ trễ/RAM/event loop. I/O,
// KHÔNG tính coverage. Điểm cache theo (truy vấn, id) ⇒ quét 96 cấu hình chỉ chấm một lần/câu.

type Passage = { id: string; text: string };

export interface RerankStats {
  /** thời gian nạp model khi đã có cache đĩa (ms) — lượt đầu có thể gồm tải về */
  coldLoadMs: number;
  /** mỗi lượt chấm THẬT (không cache) — một lượt/câu hỏi */
  callMs: number[];
  rssDeltaMb: number;
  /** khoảng hở event loop lớn nhất trong lúc chấm (ms) */
  eventLoopP99Ms: number;
}

export interface RerankScorer {
  model: string;
  modelFile: string | null;
  score: (query: string, passages: Passage[]) => Promise<Map<string, number>>;
  stats: () => RerankStats;
  dispose: () => void;
}

/** Tệp ONNX riêng theo nền tảng của a1 (research R3); model khác ⇒ dùng dtype mặc định q8. */
function fileFor(model: string, override?: string): string | null {
  if (override) return override;
  if (model === "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1") {
    return process.arch === "arm64" ? "model_qint8_arm64" : "model_quint8_avx2";
  }
  return null;
}

interface SeqModel {
  (
    inputs: unknown,
  ): Promise<{ logits: { sigmoid(): { tolist(): number[][] } } }>;
}
type Tokenizer = (
  a: string[],
  o: {
    text_pair: string[];
    padding: boolean;
    truncation: boolean;
    max_length: number;
  },
) => unknown;

export async function loadScorer(
  model: string,
  cacheDir: string,
  fileOverride?: string,
): Promise<RerankScorer> {
  env.cacheDir = cacheDir;
  const modelFile = fileFor(model, fileOverride);
  const rss0 = process.memoryUsage().rss;
  const t0 = performance.now();
  const tokenizer = (await AutoTokenizer.from_pretrained(
    model,
  )) as unknown as Tokenizer;
  // a1 (xlm-roberta) có lớp phân loại trong registry; a2 (model_type "new") phải nạp qua AutoModel (research R2).
  const net = (modelFile
    ? await AutoModelForSequenceClassification.from_pretrained(model, {
        model_file_name: modelFile,
        dtype: "fp32",
      })
    : await AutoModel.from_pretrained(model, {
        dtype: "q8",
      })) as unknown as SeqModel & { dispose?: () => Promise<void> };
  const coldLoadMs = performance.now() - t0;
  const rssDeltaMb = (process.memoryUsage().rss - rss0) / 1024 / 1024;

  const callMs: number[] = [];
  const cache = new Map<string, number>();
  // Khoảng hở lớn nhất của event loop trong lúc chấm (đo bằng nhịp setInterval 2 ms). KHÔNG dùng monitorEventLoopDelay
  // bật/tắt theo lượt — cách đó cộng cả thời gian tắt vào mẫu đầu, cho số ảo (lượt đo 2026-10-08: 1,5 s ảo vs 26–67 ms thật).
  let maxLoopGapMs = 0;

  const score = async (query: string, passages: Passage[]) => {
    const missing = passages.filter((p) => !cache.has(`${query}\u0000${p.id}`));
    if (missing.length > 0) {
      let last = performance.now();
      const tick = setInterval(() => {
        const now = performance.now();
        maxLoopGapMs = Math.max(maxLoopGapMs, now - last);
        last = now;
      }, 2);
      const t = performance.now();
      const inputs = tokenizer(
        missing.map(() => query),
        {
          text_pair: missing.map((p) => p.text),
          padding: true,
          truncation: true,
          max_length: 512,
        },
      );
      const out = await net(inputs);
      const probs = out.logits.sigmoid().tolist();
      callMs.push(performance.now() - t);
      clearInterval(tick);
      missing.forEach((p, i) =>
        cache.set(`${query}\u0000${p.id}`, probs[i][0]),
      );
    }
    return new Map(
      passages.map((p) => [p.id, cache.get(`${query}\u0000${p.id}`)!]),
    );
  };

  return {
    model,
    modelFile,
    score,
    stats: () => ({
      coldLoadMs,
      callMs: [...callMs],
      rssDeltaMb,
      eventLoopP99Ms: maxLoopGapMs,
    }),
    dispose: () => void net.dispose?.(),
  };
}

/** Phân vị (p 0..100) — dùng cho p50/p95 độ trễ. */
export function percentileOf(xs: readonly number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  if (s.length === 0) return 0;
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}
