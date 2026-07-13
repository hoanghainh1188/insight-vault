import { join } from "node:path";
import { readFile, stat, mkdir, readdir, unlink } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { app } from "electron";
import type { SourceProgressEvent } from "@shared/ipc/types";
import type { Db } from "../../db/database";
import type { AiRuntime } from "../ai-runtime/ai-runtime";
import { createSourceRepo, type SourceRepo } from "./source-repo";
import { createLanceVectorStore, type VectorStore } from "./vector-store";
import { createIngestionPipeline, type IngestionPipeline } from "./pipeline";
import { parseText } from "./parsers/text";
import { parsePdf } from "./parsers/pdf";
import { parseDocx } from "./parsers/docx";
import { parseAudio } from "./parsers/audio";
import { parseVideo } from "./parsers/video";
import { fetchAndParseUrl } from "./parsers/url";
import { createTranscriber } from "./audio/transcribe";
import { resolveFfmpegPath } from "./video/ffmpeg-path";
import { extractAudioTo16kWav } from "./video/extract-audio";
import { parseImage } from "./parsers/image";
import { createOcr } from "./image/ocr";
import { imageSizeFromFile } from "image-size/fromFile";
import { createEmbedder, type Embedder } from "../embedding/embed-model";

// Ghép domain ingestion ở main: source-repo (SQLite) + vector-store (LanceDB) + pipeline (parse/chunk/
// embed). Composition root — loại khỏi ngưỡng coverage (như ai-runtime.ts). Business logic thuần đã
// phủ ở chunker/cleaning/dedup/size-limits/status/source-repo/queue/pipeline test (DI).

export interface Ingestion {
  sourceRepo: SourceRepo;
  vectorStore: VectorStore;
  pipeline: IngestionPipeline;
  /** 059: embedder in-process (dùng CHUNG cho ingestion passage + retrieval query + reindex). */
  embedder: Embedder;
}

export async function createIngestion(opts: {
  db: Db;
  dataDir: string;
  aiRuntime: AiRuntime;
  emit: (e: SourceProgressEvent) => void;
  setOnline?: (online: boolean) => void;
}): Promise<Ingestion> {
  const sourceRepo = createSourceRepo(opts.db);
  const vectorStore = await createLanceVectorStore(
    join(opts.dataDir, "vectors"),
  );
  // 045: Whisper (transformers.js) — model tải về data dir (một lần, sau chạy offline). Lazy: chỉ tải
  // khi nạp audio đầu tiên.
  const transcriber = createTranscriber({
    cacheDir: join(opts.dataDir, "models"),
    // Báo egress khi tải model Whisper lần đầu (badge riêng tư khớp hành vi — Constitution I).
    setOnline: opts.setOnline,
  });
  // 053: OCR tesseract.js — traineddata vie+eng tải về data dir lần đầu (badge egress), sau offline. Lazy.
  const ocr = createOcr({
    cacheDir: join(opts.dataDir, "models", "tesseract"),
    isPackaged: app.isPackaged,
    setOnline: opts.setOnline,
  });
  // 059: embedding IN-PROCESS (e5-small, transformers.js) — KHÔNG cần Ollama. Model tải data dir lần đầu
  // (badge egress dùng chung 045/031), sau offline. Dùng chung cho passage (nạp nguồn) + query + reindex.
  const embedder = createEmbedder({
    cacheDir: join(opts.dataDir, "models"),
    setOnline: opts.setOnline,
  });

  const pipeline = createIngestionPipeline({
    sourceRepo,
    vectorStore,
    // 059: embedding nạp nguồn dùng embedder IN-PROCESS (e5 passage) — thay Ollama (đảo 031). Provider giữ
    // chữ ký cũ ({embed:{text}→{vector}}) để pipeline/embed.ts không đổi; adapter gắn tiền tố passage.
    getProvider: () => ({
      embed: async ({ text }) => ({
        vector: (await embedder.embed([text], "passage"))[0],
      }),
    }),
    // 059: nhúng passage theo LÔ (32/lần) — 1 forward pass cho nhiều chunk, nhanh hơn nhiều loop từng text.
    embedBatch: async (texts, onProgress) => {
      const BATCH = 32;
      const vectors: number[][] = [];
      for (let i = 0; i < texts.length; i += BATCH) {
        const part = await embedder.embed(texts.slice(i, i + BATCH), "passage");
        vectors.push(...part);
        onProgress?.(Math.min(i + BATCH, texts.length), texts.length);
      }
      const dim = vectors[0]?.length ?? 0;
      if (dim === 0 && texts.length > 0) {
        throw new Error("Embedding rỗng — model nhúng không trả vector.");
      }
      return { vectors, dim };
    },
    // Embedding in-process luôn sẵn sàng (model tải lazy khi cần) → KHÔNG còn gate theo Ollama. Nếu tải
    // model lỗi, bước embed ném lỗi → nguồn vào error (retry được), không kẹt awaiting_embedding.
    isRuntimeReady: async () => true,
    readFile: async (p) => new Uint8Array(await readFile(p)),
    parseFile: async (kind, bytes, onProgress) => {
      if (kind === "pdf") return parsePdf(bytes);
      if (kind === "docx") return parseDocx(Buffer.from(bytes));
      if (kind === "audio") return parseAudio(bytes, transcriber, onProgress);
      return parseText(new TextDecoder().decode(bytes)); // txt/md
    },
    // 051 video: tách audio (ffmpeg) → wav tạm 16kHz trong <dataDir>/tmp → parseVideo tái dùng parseAudio.
    // Resolve ffmpeg path lazy (tránh crash khởi động nếu nền tảng lạ). uuid cho tên file tạm.
    parseVideo: async (path, onProgress) => {
      const tmpDir = join(opts.dataDir, "tmp");
      await mkdir(tmpDir, { recursive: true });
      const ffmpegPath = resolveFfmpegPath(app.isPackaged);
      const extractor = (
        videoPath: string,
        outDir: string,
      ): Promise<string | null> =>
        extractAudioTo16kWav(videoPath, outDir, {
          ffmpegPath,
          uuid: () => randomUUID(),
        });
      return parseVideo(path, tmpDir, extractor, transcriber, onProgress);
    },
    // 053: OCR ảnh (tesseract.js) + đọc kích thước ảnh (image-size từ header) để chuẩn hoá bbox 0..1.
    parseImage: async (path, onProgress) => {
      // Đọc W×H CHỈ từ header ảnh (streaming, không nạp cả file vào RAM) — nhất quán hashFile/statSize.
      const readDims = async (
        p: string,
      ): Promise<{ width: number; height: number }> => {
        const d = await imageSizeFromFile(p);
        return { width: d.width || 1, height: d.height || 1 };
      };
      return parseImage(path, ocr, readDims, onProgress);
    },
    statSize: async (p) => (await stat(p)).size,
    // 051: hash sha256 + size STREAMING (không nạp cả file — kể cả video 1GB — vào RAM ở bước add()).
    hashFile: (p) =>
      new Promise((resolve, reject) => {
        const h = createHash("sha256");
        let byteLength = 0;
        const rs = createReadStream(p);
        rs.on("data", (c: string | Buffer) => {
          const b = typeof c === "string" ? Buffer.from(c) : c;
          byteLength += b.length;
          h.update(b);
        });
        rs.on("error", reject);
        rs.on("end", () => resolve({ hash: h.digest("hex"), byteLength }));
      }),
    parseUrl: (url) => fetchAndParseUrl(url),
    setOnline: opts.setOnline,
    emit: opts.emit,
  });

  // 051: dọn wav tạm mồ côi (app crash/kill giữa lúc tách audio) trong <dataDir>/tmp — best-effort, không
  // chặn khởi động. Tránh rò rỉ nội dung audio tách ra khỏi lifecycle nguồn (security review #2).
  void (async () => {
    try {
      const tmpDir = join(opts.dataDir, "tmp");
      for (const f of await readdir(tmpDir)) {
        if (f.endsWith(".wav")) await unlink(join(tmpDir, f)).catch(() => {});
      }
    } catch {
      /* tmp chưa tồn tại — bỏ qua */
    }
  })();

  return { sourceRepo, vectorStore, pipeline, embedder };
}
