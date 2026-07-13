import { pipeline, env } from "@huggingface/transformers";
import { app } from "electron";
import { logEvent } from "../../logging";
import { withE5Prefix, type EmbedRole } from "./e5-prefix";
import { l2normalize } from "./vector-normalize";
import { EMBEDDING_DIM, EMBEDDING_MODEL } from "./model-version";

// Embedding in-process (059) bằng transformers.js feature-extraction — tái dùng ĐÚNG hạ tầng model-load
// của 045 (Whisper): env.cacheDir data dir, progress_callback, setOnline badge quanh lần tải model đầu.
// KHÔNG cần Ollama cho embed. Constitution III: inference CHỈ ở main. KHÔNG log nội dung. I/O — loại khỏi
// ngưỡng coverage (phần thuần ở e5-prefix / vector-normalize).

export interface Embedder {
  /**
   * Nhúng danh sách text in-process. `role` gắn tiền tố e5 (query/passage). onProgress(0..1): tải model
   * (lần đầu) → nhúng. Trả về vector 384d đã chuẩn hoá L2.
   */
  embed(
    texts: string[],
    role: EmbedRole,
    onProgress?: (frac: number) => void,
  ): Promise<number[][]>;
}

type Extractor = (
  input: string[],
  opts: { pooling: "mean"; normalize: boolean },
) => Promise<{ tolist(): number[][] }>;

/**
 * Fake embedder tất định (chỉ khi env IV_EMBED_FAKE=1) — dùng cho E2E: KHÔNG tải model, offline, nhanh.
 * Vector suy từ hash text → cùng text luôn cho cùng vector (đủ để pipeline nạp/lưu/search chạy end-to-end).
 * KHÔNG bao giờ bật ở production (env do harness test đặt).
 */
function createFakeEmbedder(): Embedder {
  const vecFor = (text: string): number[] => {
    const v = new Array<number>(EMBEDDING_DIM);
    let h = 2166136261 >>> 0; // FNV-1a seed
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      h ^= h << 13;
      h ^= h >>> 17;
      h ^= h << 5;
      h >>>= 0;
      v[i] = (h / 0xffffffff) * 2 - 1; // [-1, 1]
    }
    return l2normalize(v);
  };
  return {
    async embed(texts, role) {
      return texts.map((t) => vecFor(withE5Prefix(t, role)));
    },
  };
}

export function createEmbedder(opts: {
  cacheDir: string;
  model?: string;
  /** Bật/tắt chỉ báo egress khi TẢI model lần đầu từ HF (Constitution I — badge khớp hành vi 045/031). */
  setOnline?: (online: boolean) => void;
}): Embedder {
  // Seam E2E: tránh tải model ~120MB trong test (offline, tất định). Chỉ khi harness đặt env VÀ app CHƯA
  // đóng gói (defense-in-depth: bản phát hành không thể bật nhầm dù ai đó set env — security review 059).
  if (process.env.IV_EMBED_FAKE === "1" && !app.isPackaged) {
    return createFakeEmbedder();
  }

  const model = opts.model ?? EMBEDDING_MODEL;
  // Model tải về data dir (một lần), sau chạy offline — như Whisper 045.
  env.cacheDir = opts.cacheDir;
  let pipePromise: Promise<Extractor> | null = null;

  const loadPipe = (
    onProgress?: (frac: number) => void,
  ): Promise<Extractor> => {
    if (pipePromise) return pipePromise;
    logEvent("embed.model.load", { model });
    // Lần đầu tải weight qua mạng (HF Hub) → báo egress; tắt khi xong (cache local).
    opts.setOnline?.(true);
    pipePromise = pipeline("feature-extraction", model, {
      progress_callback: (p: unknown) => {
        const pr = p as { status?: string; progress?: number };
        if (pr?.status === "progress" && typeof pr.progress === "number") {
          onProgress?.((pr.progress / 100) * 0.5);
        }
      },
    }).finally(() => opts.setOnline?.(false)) as Promise<Extractor>;
    return pipePromise;
  };

  return {
    async embed(texts, role, onProgress) {
      if (texts.length === 0) return [];
      const extractor = await loadPipe(onProgress);
      onProgress?.(0.5);
      const prefixed = texts.map((t) => withE5Prefix(t, role));
      const out = await extractor(prefixed, {
        pooling: "mean",
        normalize: true,
      });
      onProgress?.(1);
      // tolist() → number[][] (mỗi hàng 1 vector). Chuẩn hoá L2 lần nữa cho cosine/MMR ổn định.
      return out.tolist().map((v) => l2normalize(v));
    },
  };
}
