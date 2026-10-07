import type {
  AddSourceInput,
  AddSourceResult,
  IngestStep,
  Source,
  SourceKind,
  SourceProgressEvent,
} from "@shared/ipc/types";
import type { SourceRepo } from "./source-repo";
import type { VectorStore, VectorRecord } from "./vector-store";
import type { LLMProvider } from "../ai-runtime/provider";
import type { ParseResult } from "./parsers";
import { PDF_EXTRACTION_VERSION } from "@shared/ipc/types";
import { detectKindFromPath, titleFromPath } from "./parsers";
import { cleanText } from "./cleaning";
import { chunkPages, type PageText } from "./chunker";
import { timeForCharRange } from "./audio/audio-transcript";
import { bboxForCharRange } from "./image/image-transcript";
import { embedTexts } from "./embed";
import { errorLabelForStep } from "./status";
import { SizeLimitError, assertWithinLimit } from "./size-limits";
import { hashBytes, urlContentHash } from "./dedup";
import { createSerialQueue } from "./queue";
import { REPROCESS_ERRORS } from "./reprocess-guard";
import { randomUUID } from "node:crypto";

// Điều phối pipeline nạp nguồn (FR-004..010). TUẦN TỰ 1 nguồn/lần (queue). Toàn bộ DI → unit-test
// không cần Electron/LanceDB thật. KHÔNG log nội dung tài liệu (Constitution III).

export interface PipelineDeps {
  sourceRepo: SourceRepo;
  vectorStore: VectorStore;
  getProvider: () => Pick<LLMProvider, "embed"> | null;
  // 059: nhúng passage theo LÔ (1 lần gọi model cho nhiều chunk) — nhanh hơn nhiều so với loop từng text
  // qua getProvider().embed. Thiếu → fallback embedTexts(provider) từng text (test harness cũ).
  embedBatch?: (
    texts: string[],
    onProgress?: (done: number, total: number) => void,
  ) => Promise<{ vectors: number[][]; dim: number }>;
  isRuntimeReady: () => Promise<boolean>;
  readFile: (filePath: string) => Promise<Uint8Array>;
  parseFile: (
    kind: Exclude<SourceKind, "url">,
    bytes: Uint8Array,
    /** 045: tiến độ phụ bước parse (audio transcribe/tải model dài) — 0..1. */
    onProgress?: (frac: number) => void,
  ) => Promise<ParseResult>;
  parseUrl?: (url: string) => Promise<ParseResult>;
  // 051 video: ffmpeg đọc file GỐC theo path (không nạp 1GB vào RAM); statSize để kiểm giới hạn.
  parseVideo?: (
    path: string,
    onProgress?: (frac: number) => void,
  ) => Promise<ParseResult>;
  // 053 image: OCR đọc file theo path (không nạp vào RAM qua readFile như audio); statSize kiểm giới hạn.
  parseImage?: (
    path: string,
    onProgress?: (frac: number) => void,
  ) => Promise<ParseResult>;
  statSize?: (path: string) => Promise<number>;
  // 051: hash + size STREAMING (không nạp cả file vào RAM) — cho video/audio lớn ở bước add(). Tuỳ chọn:
  // thiếu thì fallback readFile+hashBytes (test harness cũ). sha256 hex khớp hashBytes → dedup nhất quán.
  hashFile?: (path: string) => Promise<{ hash: string; byteLength: number }>;
  setOnline?: (online: boolean, kind?: "url" | "model") => void;
  emit: (e: SourceProgressEvent) => void;
  /** 112: kho đang sao lưu/khôi phục (085) ⇒ không hoán đổi dữ liệu của lần xử lý lại. */
  isVaultLocked?: () => boolean;
  /** 112: sinh id chunk mới cho lần xử lý lại (test cố định; mặc định randomUUID). */
  newChunkId?: () => string;
  /** 112: ghi sự kiện chẩn đoán (KHÔNG nội dung tài liệu). */
  logEvent?: (event: string) => void;
}

export interface IngestionPipeline {
  add(input: AddSourceInput): Promise<AddSourceResult>;
  retry(id: string): Promise<Source>;
  /**
   * 112: xử lý lại nguồn PDF bằng cách trích hiện hành. Nguồn `ready`: dựng chunk + vector mới trong RAM rồi hoán đổi
   * nguyên tử (giữ bản cũ khi lỗi/huỷ). Nguồn `error`: như retry. Ném nếu nguồn đang trong hàng đợi.
   */
  reprocess(id: string): Promise<void>;
  /** 112: huỷ lần xử lý lại đang chờ/chạy; false nếu không có. */
  cancelReprocess(id: string): boolean;
  remove(id: string): Promise<{ deleted: true }>;
  resumeAwaiting(): Promise<void>;
  /** Đánh dấu nguồn kẹt queued/processing sau restart → error (retry được). Gọi lúc khởi động. */
  resumeInterrupted(): void;
  whenIdle(): Promise<void>;
}

class StepError extends Error {
  constructor(
    readonly step: IngestStep,
    readonly label: string,
  ) {
    super(label);
  }
}

/**
 * Làm sạch một trang. 112 (FR-008, research R7): giữ `blocks` (vùng bảng) CHỈ khi làm sạch không đổi văn bản —
 * nếu đổi thì offset của blocks không còn đúng ⇒ bỏ blocks (chunk vẫn hợp lệ, chỉ mất ưu tiên không cắt bảng).
 */
function cleanPage(p: PageText): PageText {
  const text = cleanText(p.text);
  return p.blocks && p.blocks.length > 0 && text === p.text
    ? { page: p.page, text, blocks: p.blocks }
    : { page: p.page, text };
}

/** 112: thông báo khi xử lý lại thất bại (nguồn vẫn dùng bản cũ). */
export const REPROCESS_FAILED_LABEL = "Xử lý lại thất bại — vẫn dùng bản cũ.";

export function createIngestionPipeline(deps: PipelineDeps): IngestionPipeline {
  const { sourceRepo, vectorStore, emit } = deps;
  const queue = createSerialQueue();

  // 112: id đang "Xử lý lại" (nguồn ready) ⇒ mọi sự kiện của nó gắn cờ reprocess.
  const reprocessing = new Set<string>();

  const send = (
    s: Source,
    step: IngestStep,
    progress: number,
    errorLabel?: string,
  ): void => {
    emit({
      sourceId: s.id,
      notebookId: s.notebookId,
      status: s.status,
      step,
      progress,
      ...(errorLabel ? { errorLabel } : {}),
      ...(reprocessing.has(s.id) ? { reprocess: true as const } : {}),
    });
  };

  const reload = (id: string): Source | null => sourceRepo.getById(id);

  // Parse + clean → các trang đã làm sạch. Ném StepError nếu lỗi/không có nội dung.
  const parseAndClean = async (
    src: Source,
  ): Promise<{
    pages: PageText[];
    pageCount: number | null;
    title?: string;
    timeMap?: ParseResult["timeMap"];
    boxMap?: ParseResult["boxMap"];
  }> => {
    let result: ParseResult;
    try {
      if (src.kind === "url") {
        if (!deps.parseUrl) throw new Error("URL chưa hỗ trợ");
        deps.setOnline?.(true, "url");
        try {
          result = await deps.parseUrl(sourceOrigin(src));
        } finally {
          deps.setOnline?.(false, "url");
        }
      } else if (src.kind === "video") {
        // 051: ffmpeg đọc thẳng file gốc theo path → KHÔNG nạp cả file (tới 1GB) vào RAM. Kiểm giới hạn
        // qua stat. Tiến độ: tách audio + bóc băng gộp trong bước parse (0.1→0.25).
        if (!deps.parseVideo || !deps.statSize) {
          throw new StepError("parse", errorLabelForStep("parse", src.kind));
        }
        const size = await deps.statSize(sourceOrigin(src));
        assertWithinLimit("video", size);
        result = await deps.parseVideo(sourceOrigin(src), (frac) => {
          const s = reload(src.id);
          if (s) send(s, "parse", 0.1 + Math.max(0, Math.min(1, frac)) * 0.15);
        });
      } else if (src.kind === "image") {
        // 053: OCR đọc file theo path (như video, không nạp vào RAM). Tiến độ OCR trong bước parse.
        if (!deps.parseImage || !deps.statSize) {
          throw new StepError("parse", errorLabelForStep("parse", src.kind));
        }
        const size = await deps.statSize(sourceOrigin(src));
        assertWithinLimit("image", size);
        result = await deps.parseImage(sourceOrigin(src), (frac) => {
          const s = reload(src.id);
          if (s) send(s, "parse", 0.1 + Math.max(0, Math.min(1, frac)) * 0.15);
        });
      } else {
        const bytes = await deps.readFile(sourceOrigin(src));
        assertWithinLimit(src.kind, bytes.byteLength);
        // Audio (045): transcribe/tải model dài → báo tiến độ phụ trong bước parse (0.1→0.25).
        result = await deps.parseFile(src.kind, bytes, (frac) => {
          const s = reload(src.id);
          if (s) send(s, "parse", 0.1 + Math.max(0, Math.min(1, frac)) * 0.15);
        });
      }
    } catch (e) {
      if (e instanceof SizeLimitError) throw new StepError("parse", e.label);
      throw new StepError("parse", errorLabelForStep("parse", src.kind));
    }
    const cleaned = result.pages
      .map((p) => cleanPage(p))
      .filter((p) => p.text.length > 0);
    // Video no-audio (051) / ảnh không chữ (053) → transcript rỗng: VẪN nạp thành công (ready, 0 chunk,
    // media vẫn xem được — FR-011/FR-010). Các loại khác rỗng = lỗi parse.
    if (cleaned.length === 0 && src.kind !== "video" && src.kind !== "image") {
      throw new StepError("parse", errorLabelForStep("parse", src.kind));
    }
    return {
      pages: cleaned,
      pageCount: result.pageCount,
      title: result.title,
      timeMap: result.timeMap,
      boxMap: result.boxMap,
    };
  };

  // origin (đường dẫn/URL) KHÔNG nằm trong Source (không lộ renderer). LUÔN đọc cột `origin` từ SQLite (rẻ) —
  // nguồn sự thật duy nhất: resume sau restart (B3) và "chọn lại tệp gốc" (101, đổi origin giữa phiên) đều đúng.
  // (Trước 101 có cache RAM theo phiên ⇒ retry sau khi chọn lại tệp vẫn đọc đường dẫn cũ.)
  const sourceOrigin = (src: Source): string =>
    sourceRepo.getOrigin(src.id) ?? "";

  // Embed + lưu vector cho các chunk đã có trong SQLite. Ném StepError nếu lỗi.
  // Nhận `signal` để KHÔNG ghi vector nếu nguồn đã bị huỷ/xoá giữa chừng (B2 — tránh vector mồ côi).
  const embedAndStore = async (
    src: Source,
    signal: { cancelled: boolean },
  ): Promise<boolean> => {
    const ready = await deps.isRuntimeReady();
    const provider = deps.getProvider();
    if (!ready || !provider) {
      sourceRepo.updateStatus(src.id, "awaiting_embedding");
      const s = reload(src.id);
      if (s) send(s, "embed", 0.5);
      return false; // chưa ready — dừng ở awaiting_embedding
    }
    const chunks = sourceRepo.listChunks(src.id);
    let vectors: number[][];
    let dim: number;
    const onEmbedProgress = (done: number, total: number): void => {
      const s = reload(src.id);
      if (s) send(s, "embed", total ? done / total : 1);
    };
    try {
      // 059: ưu tiên nhúng theo LÔ (nhanh hơn) nếu có; fallback loop từng text qua provider (test cũ).
      const res = deps.embedBatch
        ? await deps.embedBatch(
            chunks.map((c) => c.text),
            onEmbedProgress,
          )
        : await embedTexts(
            provider,
            chunks.map((c) => c.text),
            onEmbedProgress,
          );
      vectors = res.vectors;
      dim = res.dim;
    } catch {
      throw new StepError("embed", errorLabelForStep("embed", src.kind));
    }
    // Nguồn bị xoá/huỷ trong lúc embed (remove() đã dọn SQLite+vector) → KHÔNG ghi lại vector mồ côi.
    if (signal.cancelled || sourceRepo.getById(src.id) === null) return false;
    try {
      const records: VectorRecord[] = chunks.map((c, i) => ({
        id: c.id,
        notebookId: src.notebookId,
        sourceId: src.id,
        vector: vectors[i],
        dim,
      }));
      await vectorStore.deleteBySource(src.id); // idempotent (retry an toàn)
      await vectorStore.add(records);
    } catch {
      throw new StepError("store", errorLabelForStep("store", src.kind));
    }
    return true;
  };

  // 112: nhúng văn bản chunk TRONG RAM (không ghi gì) — dùng cho xử lý lại. Ném StepError("embed") khi lỗi.
  const embedInMemory = async (
    src: Source,
    texts: string[],
  ): Promise<{ vectors: number[][]; dim: number }> => {
    const provider = deps.getProvider();
    if (!(await deps.isRuntimeReady()) || !provider) {
      throw new StepError("embed", errorLabelForStep("embed", src.kind));
    }
    const onEmbedProgress = (done: number, total: number): void => {
      const s = reload(src.id);
      if (s) send(s, "embed", total ? done / total : 1);
    };
    try {
      return deps.embedBatch
        ? await deps.embedBatch(texts, onEmbedProgress)
        : await embedTexts(provider, texts, onEmbedProgress);
    } catch {
      throw new StepError("embed", errorLabelForStep("embed", src.kind));
    }
  };

  /**
   * 112 (FR-015, research R10): xử lý lại nguồn READY — nguồn giữ `ready` (dữ liệu cũ dùng được) tới khi bản mới dựng
   * xong: parse → chunk → embed trong RAM → add vector mới → replaceChunks (1 transaction) → xoá vector cũ. Lỗi/huỷ
   * trước hoán đổi ⇒ không đổi gì (vector mới đã thêm bị xoá).
   */
  const reprocessReady = async (
    id: string,
    signal: { cancelled: boolean },
  ): Promise<void> => {
    const finish = (errorLabel?: string): void => {
      const s = reload(id);
      if (s) send(s, "done", errorLabel ? 0 : 1, errorLabel);
      reprocessing.delete(id);
    };
    const src = reload(id);
    if (!src || signal.cancelled) return finish();
    let newIds: string[] = [];
    let added = false;
    try {
      const { pages, pageCount } = await parseAndClean(src);
      if (signal.cancelled || !reload(id)) return finish();
      const drafts = chunkPages(pages);
      send(src, "chunk", 0.4);
      newIds = drafts.map(() => (deps.newChunkId ?? randomUUID)());
      const { vectors, dim } = await embedInMemory(
        src,
        drafts.map((d) => d.text),
      );
      if (signal.cancelled || !reload(id)) return finish();
      if (deps.isVaultLocked?.()) {
        throw new StepError("store", REPROCESS_ERRORS.vaultLocked);
      }
      const oldIds = sourceRepo.chunkIds(id);
      added = true;
      await vectorStore.add(
        drafts.map((_, i) => ({
          id: newIds[i],
          notebookId: src.notebookId,
          sourceId: id,
          vector: vectors[i],
          dim,
        })),
      );
      if (signal.cancelled || !reload(id)) {
        await vectorStore.deleteByIds(newIds).catch(() => {});
        return finish();
      }
      sourceRepo.replaceChunks(id, drafts, newIds, {
        extractionVersion: PDF_EXTRACTION_VERSION,
        pageCount,
      });
      added = false; // từ đây vector mới là dữ liệu chính thức
      try {
        await vectorStore.deleteByIds(oldIds);
      } catch {
        // Vector mồ côi (chunk cũ không còn) vô hại cho đúng đắn; dọn ở lần xoá/xử lý lại sau.
        deps.logEvent?.("ingest.reprocess.orphanVectors");
      }
      finish();
    } catch (e) {
      if (added) await vectorStore.deleteByIds(newIds).catch(() => {});
      if (signal.cancelled) return finish();
      const vault =
        e instanceof StepError && e.label === REPROCESS_ERRORS.vaultLocked;
      finish(
        vault
          ? `${REPROCESS_ERRORS.vaultLocked} Xử lý lại bị huỷ, vẫn dùng bản cũ.`
          : REPROCESS_FAILED_LABEL,
      );
    }
  };

  const finishReady = (src: Source): void => {
    sourceRepo.updateStatus(src.id, "ready");
    const s = reload(src.id);
    if (s) send(s, "done", 1);
  };

  // Xử lý một nguồn từ đầu (parse→chunk→embed→store). Dùng cho add + retry.
  const processFull = async (
    id: string,
    signal: { cancelled: boolean },
  ): Promise<void> => {
    let src = reload(id);
    if (!src || signal.cancelled) return;
    sourceRepo.updateStatus(id, "processing");
    src = reload(id)!;
    send(src, "parse", 0.1);
    try {
      const { pages, pageCount, title, timeMap, boxMap } =
        await parseAndClean(src);
      if (signal.cancelled) return;
      if (pageCount != null) sourceRepo.setPageCount(id, pageCount);
      if (title && src.kind === "url") {
        sourceRepo.setTitle(id, title); // tiêu đề trang cho nguồn URL
      }
      send(reload(id)!, "clean", 0.3);
      const drafts = chunkPages(pages);
      // Audio (045): gắn tStart/tEnd cho mỗi chunk từ timeMap (theo char-range của chunk).
      const withTime = timeMap
        ? drafts.map((d) => {
            const t = timeForCharRange(
              timeMap,
              d.locator.charStart,
              d.locator.charEnd,
            );
            return t
              ? {
                  ...d,
                  locator: { ...d.locator, tStart: t.tStart, tEnd: t.tEnd },
                }
              : d;
          })
        : drafts;
      // Ảnh (053): gắn bbox (vùng chữ) cho mỗi chunk từ boxMap (theo char-range của chunk).
      const located = boxMap
        ? withTime.map((d) => {
            const bb = bboxForCharRange(
              boxMap,
              d.locator.charStart,
              d.locator.charEnd,
            );
            return bb ? { ...d, locator: { ...d.locator, bbox: bb } } : d;
          })
        : withTime;
      sourceRepo.deleteChunks(id); // sạch trước khi ghi (retry an toàn)
      sourceRepo.insertChunks(id, located);
      // 112: chunk PDF vừa tạo bằng cách trích có bố cục ⇒ ghi phiên bản (gợi ý "Xử lý lại" biến mất).
      if (src.kind === "pdf") {
        sourceRepo.setExtractionVersion(id, PDF_EXTRACTION_VERSION);
      }
      send(reload(id)!, "chunk", 0.4);
      if (signal.cancelled) return;
      const embedded = await embedAndStore(reload(id)!, signal);
      // Nguồn có thể đã bị xoá trong lúc embed → không finishReady (tránh ghi trạng thái cho id đã xoá).
      if (embedded && !signal.cancelled && reload(id)) finishReady(reload(id)!);
    } catch (e) {
      if (signal.cancelled) return;
      const step = e instanceof StepError ? e.step : "parse";
      const label =
        e instanceof StepError ? e.label : errorLabelForStep("parse", src.kind);
      sourceRepo.updateStatus(id, "error", label);
      const s = reload(id);
      if (s) send(s, step, 0, label);
    }
  };

  const api: IngestionPipeline = {
    async add(input) {
      // Validate Ở BOUNDARY (không tin thẳng renderer — Constitution III, coding-style "validate at boundaries").
      if (
        !input ||
        typeof input.notebookId !== "string" ||
        input.notebookId === ""
      ) {
        throw new Error("notebookId không hợp lệ.");
      }
      const origin = input.kind === "url" ? input.url : input.filePath;
      if (typeof origin !== "string" || origin.trim() === "") {
        throw new Error("Nguồn thiếu đường dẫn tệp hoặc URL.");
      }
      // Constitution I (No Default Egress): nguồn tệp PHẢI là path cục bộ, KHÔNG phải URL. Chặn scheme
      // `xxx://` (http/https/file/ftp…) — một số parser (tesseract.js loadImage) tự fetch nếu path giống
      // URL, gây egress ngầm không qua badge. Windows `C:\` (không có `//`) và UNC `\\` không bị chặn.
      if (
        input.kind !== "url" &&
        /^[a-z][a-z0-9+.-]*:\/\//i.test(input.filePath.trim())
      ) {
        throw new Error("Đường dẫn tệp phải là tệp cục bộ (không phải URL).");
      }
      // Derive/validate kind từ đường dẫn (chống renderer khai man loại tệp).
      const kind =
        input.kind === "url" ? "url" : detectKindFromPath(input.filePath);
      let contentHash: string;
      const pageCount: number | null = null;
      let title: string;
      let sizeError = false;

      if (input.kind === "url") {
        contentHash = urlContentHash(input.url);
        title = input.url;
      } else {
        title = titleFromPath(input.filePath);
        // 051: hash + size STREAMING nếu có (video/audio lớn → KHÔNG nạp cả file vào RAM ở add()).
        let byteLength: number;
        if (deps.hashFile) {
          const r = await deps.hashFile(input.filePath);
          contentHash = r.hash;
          byteLength = r.byteLength;
        } else {
          const bytes = await deps.readFile(input.filePath);
          contentHash = hashBytes(bytes);
          byteLength = bytes.byteLength;
        }
        if (byteLength > 0) {
          try {
            assertWithinLimit(kind, byteLength);
          } catch {
            sizeError = true;
          }
        }
      }

      const dup = sourceRepo.findDuplicate(input.notebookId, contentHash);
      const source = sourceRepo.create({
        notebookId: input.notebookId,
        kind,
        title,
        origin,
        contentHash,
        pageCount,
      });

      if (sizeError) {
        sourceRepo.updateStatus(source.id, "error", "Tệp quá lớn");
        const s = reload(source.id)!;
        send(s, "parse", 0, "Tệp quá lớn");
        return { source: s, duplicateWarning: dup !== null };
      }

      queue.enqueue(source.id, (signal) => processFull(source.id, signal));
      return { source, duplicateWarning: dup !== null };
    },

    async retry(id) {
      const src = sourceRepo.getById(id);
      if (!src) throw new Error("Nguồn không tồn tại.");
      if (src.status !== "error")
        throw new Error("Chỉ thử lại nguồn đang lỗi.");
      await vectorStore.deleteBySource(id);
      sourceRepo.deleteChunks(id);
      sourceRepo.updateStatus(id, "queued");
      const queued = sourceRepo.getById(id)!;
      send(queued, "parse", 0);
      queue.enqueue(id, (signal) => processFull(id, signal));
      return queued;
    },

    async reprocess(id) {
      const src = sourceRepo.getById(id);
      if (!src) throw new Error(REPROCESS_ERRORS.notFound);
      if (queue.has(id)) throw new Error(REPROCESS_ERRORS.busy);
      // Nguồn lỗi (chưa từng sẵn sàng) ⇒ thử lại bằng cách trích hiện hành (processFull ghi phiên bản mới).
      if (src.status === "error") {
        await api.retry(id);
        return;
      }
      if (src.status !== "ready") throw new Error(REPROCESS_ERRORS.badStatus);
      reprocessing.add(id);
      send(src, "parse", 0.05);
      queue.enqueue(id, (signal) => reprocessReady(id, signal));
    },

    cancelReprocess(id) {
      if (!reprocessing.has(id) || !queue.has(id)) return false;
      queue.cancel(id);
      // Hàng đợi bỏ việc chưa chạy mà không gọi lại ⇒ tự kết thúc sự kiện ở đây (việc đang chạy tự kết thúc).
      queueMicrotask(() => {
        if (reprocessing.has(id) && !queue.has(id)) {
          const s = reload(id);
          if (s) send(s, "done", 1);
          reprocessing.delete(id);
        }
      });
      return true;
    },

    async remove(id) {
      queue.cancel(id);
      await vectorStore.deleteBySource(id);
      return sourceRepo.delete(id); // cascade chunk
    },

    async resumeAwaiting() {
      const ready = await deps.isRuntimeReady();
      if (!ready) return;
      const pending = sourceRepo.listByStatus("awaiting_embedding");
      for (const src of pending) {
        queue.enqueue(src.id, async (signal) => {
          if (signal.cancelled) return;
          const cur = reload(src.id);
          if (!cur || cur.status !== "awaiting_embedding") return;
          sourceRepo.updateStatus(src.id, "processing");
          try {
            const embedded = await embedAndStore(reload(src.id)!, signal);
            if (embedded && !signal.cancelled && reload(src.id)) {
              finishReady(reload(src.id)!);
            }
          } catch (e) {
            const label =
              e instanceof StepError ? e.label : errorLabelForStep("embed");
            sourceRepo.updateStatus(src.id, "error", label);
            const s = reload(src.id);
            if (s) send(s, "embed", 0, label);
          }
        });
      }
    },

    resumeInterrupted() {
      // Nguồn kẹt 'queued'/'processing' từ phiên trước (app đóng/crash giữa chừng) chỉ tồn tại trong
      // SerialQueue RAM đã mất → đánh dấu 'error' (retry được) để người dùng bấm "Thử lại" (B3, FR-013).
      for (const status of ["queued", "processing"] as const) {
        for (const src of sourceRepo.listByStatus(status)) {
          sourceRepo.updateStatus(
            src.id,
            "error",
            "Gián đoạn khi nạp — thử lại",
          );
          const s = reload(src.id);
          if (s) send(s, "parse", 0, "Gián đoạn khi nạp — thử lại");
        }
      }
    },

    whenIdle: () => queue.whenIdle(),
  };
  return api;
}
