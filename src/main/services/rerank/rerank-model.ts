import {
  AutoModelForSequenceClassification,
  AutoTokenizer,
} from "@huggingface/transformers";
import { app } from "electron";
import { logEvent } from "../../logging";
import { RerankBusyError, RerankNotReadyError } from "../rag/rerank-filter";
import { fakeRerankScore } from "./fake-score";
import {
  canRetryDownload,
  nextRerankerState,
  type RerankerState,
} from "./status";

// 109 (contracts/reranker-service.md): bộ chấm độ liên quan (cross-encoder) IN-PROCESS ở main — cùng khuôn embed-model.ts
// (059): model tải một lần vào data dir (badge egress "model" trong lúc tải), sau chạy offline. Constitution III: suy luận CHỈ ở
// main; KHÔNG log câu hỏi/đoạn văn. I/O — loại khỏi ngưỡng coverage (phần thuần: status.ts, fake-score.ts, rerank-filter.ts).

type Passage = { id: string; text: string };

export interface Reranker {
  status(): RerankerState;
  /** tải/nạp nền; không ném; gọi lặp vô hại */
  prefetch(): void;
  /** điểm 0..1 cho từng đoạn; ném RerankNotReadyError khi chưa nạp xong (đồng thời kích tải nền) */
  score(query: string, passages: Passage[]): Promise<Map<string, number>>;
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
type SeqModel = (inputs: unknown) => Promise<{
  logits: { sigmoid(): { tolist(): number[][] } };
}>;

export function createReranker(opts: {
  cacheDir: string;
  model: string;
  /** commit cố định trên Hugging Face (không kéo `main`) */
  revision: string;
  modelFile: string;
  maxTokens: number;
  setOnline?: (online: boolean, kind?: "model") => void;
}): Reranker {
  // Seam E2E: không tải model (~119 MB), tất định. Chỉ khi env VÀ app CHƯA đóng gói (như IV_EMBED_FAKE — 059).
  if (process.env.IV_RERANK_FAKE === "1" && !app.isPackaged) {
    return {
      status: () => "ready",
      prefetch: () => undefined,
      score: async (q, ps) =>
        new Map(ps.map((p) => [p.id, fakeRerankScore(q, p.text)])),
    };
  }

  let state: RerankerState = "idle";
  let loaded: { tok: Tokenizer; net: SeqModel } | null = null;
  // Hàng đợi tuần tự: một phiên ONNX, không chấm song song (tránh tranh CPU với embedder). Tối đa MỘT lượt chạy + MỘT lượt chờ;
  // nhiều hơn ⇒ RerankBusyError (retrieve() bỏ qua bước chấm) — lượt quá hạn không dồn hàng (review 109).
  let queue: Promise<unknown> = Promise.resolve();
  let inFlight = 0;
  // Lỗi tải gần nhất — offline không thử tải lại ở mỗi câu hỏi (review 109: chờ RETRY_COOLDOWN_MS).
  let lastFailedAt: number | null = null;
  // cache_dir/revision theo từng lần nạp — KHÔNG đổi env.cacheDir toàn cục dùng chung với embedder/Whisper.
  const hub = { cache_dir: opts.cacheDir, revision: opts.revision };

  const prefetch = (): void => {
    if (state === "error" && !canRetryDownload(lastFailedAt, Date.now())) {
      return;
    }
    const next = nextRerankerState(state, "start");
    if (next === state) return; // đang tải / đã sẵn sàng
    state = next;
    logEvent("rerank.model.load", { model: opts.model });
    opts.setOnline?.(true, "model");
    void (async () => {
      try {
        const tok = (await AutoTokenizer.from_pretrained(
          opts.model,
          hub,
        )) as unknown as Tokenizer;
        const net = (await AutoModelForSequenceClassification.from_pretrained(
          opts.model,
          { ...hub, model_file_name: opts.modelFile, dtype: "fp32" },
        )) as unknown as SeqModel;
        loaded = { tok, net };
        state = nextRerankerState(state, "loaded");
      } catch (e) {
        state = nextRerankerState(state, "failed");
        lastFailedAt = Date.now();
        logEvent("rerank.model.error", {
          model: opts.model,
          errorType: e instanceof Error ? e.constructor.name : typeof e,
        });
      } finally {
        opts.setOnline?.(false, "model");
      }
    })();
  };

  const run = async (
    query: string,
    passages: Passage[],
  ): Promise<Map<string, number>> => {
    const { tok, net } = loaded!;
    const inputs = tok(
      passages.map(() => query),
      {
        text_pair: passages.map((p) => p.text),
        padding: true,
        truncation: true,
        max_length: opts.maxTokens,
      },
    );
    const probs = (await net(inputs)).logits.sigmoid().tolist();
    return new Map(passages.map((p, i) => [p.id, probs[i][0]]));
  };

  return {
    status: () => state,
    prefetch,
    score(query, passages) {
      if (state !== "ready" || !loaded) {
        prefetch();
        return Promise.reject(new RerankNotReadyError());
      }
      if (passages.length === 0) return Promise.resolve(new Map());
      if (inFlight >= 2) return Promise.reject(new RerankBusyError());
      inFlight += 1;
      const job = queue
        .then(() => run(query, passages))
        .finally(() => {
          inFlight -= 1;
        });
      queue = job.catch(() => undefined);
      return job;
    },
  };
}
