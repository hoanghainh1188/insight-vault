import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Unit test chạy ở môi trường node, KHÔNG cần Electron runtime.
// Coverage chỉ tính "business logic" (Constitution IV, Article W ≥ 80%):
// services thuần + helpers + shared ipc. File chạm electron (index/register/preload) + UI renderer
// phủ bởi e2e (Playwright), loại khỏi coverage để không làm sai lệch ngưỡng.
export default defineConfig({
  resolve: { alias: { "@shared": resolve("src/shared") } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/main/services/**/*.ts",
        "src/main/db/**/*.ts",
        "src/main/logging.ts",
        "src/shared/ipc/**/*.ts",
        "src/shared/notebook-palette.ts",
        "src/renderer/features/notebooks/relative-time.ts",
        "src/renderer/features/sources/source-status.ts",
        "src/renderer/features/rag-qa/citation-format.ts",
        "src/renderer/features/source-viewer/highlight.ts",
        "src/main/services/studio/studio-repo.ts",
        "src/main/services/studio/prompt.ts",
        "src/main/services/studio/export-name.ts",
        "src/main/services/rag/chat-repo.ts",
        "src/main/services/rag/fusion.ts",
        "src/main/services/rag/rewrite.ts",
        "src/main/services/rag/retrieval.ts",
        "src/main/services/ingestion/fts-fold.ts",
        "src/main/services/ingestion/keyword-store.ts",
        "src/renderer/shared/useModalA11y.ts",
        "src/renderer/shared/lastNotebook.ts",
        "src/renderer/shared/markdown/remark-cite.ts",
        "src/renderer/features/sources/useColumnWidths.ts",
        "src/renderer/shared/format-bytes.ts",
        "src/main/services/app-shell/storage-info.ts",
        "src/main/services/ai-runtime/online/stream-parse.ts",
        "src/renderer/shared/shortcuts.ts",
        "src/main/services/ingestion/audio/resample.ts",
        "src/main/services/ingestion/audio/audio-transcript.ts",
        "src/main/services/source-viewer/media-range.ts",
        "src/main/services/ingestion/video/ffmpeg-path.ts",
        "src/main/services/ingestion/parsers/video.ts",
        "src/main/services/ingestion/image/image-transcript.ts",
        "src/main/services/ingestion/image/ocr-path.ts",
        "src/main/services/ingestion/parsers/image.ts",
      ],
      // Composition roots / wiring quanh thư viện ngoài (I/O native, parser lib) — phủ bởi e2e/integration,
      // không phải business logic thuần. Loại khỏi ngưỡng coverage.
      // Chỉ loại các adapter I/O native / composition root (không test được thuần). pipeline.ts GIỮ
      // trong ngưỡng vì chứa business logic (cancel/resume/error-by-step) đã phủ test bằng DI.
      exclude: [
        "src/main/services/ai-runtime/ai-runtime.ts",
        "src/main/services/ingestion/ingestion.ts",
        "src/main/services/ingestion/vector-store.ts",
        "src/main/services/ingestion/parsers/pdf.ts",
        "src/main/services/ingestion/parsers/docx.ts",
        "src/main/services/ingestion/parsers/url.ts",
        "src/main/services/source-viewer/source-content.ts",
        "src/main/services/studio/studio-service.ts",
        "src/main/services/studio/export.ts",
        // online-provider (031): adapter I/O HTTP + native keytar loader — phủ qua provider tests (fetch giả)
        // + e2e/thủ công, không phải logic thuần đo ngưỡng.
        "src/main/services/ai-runtime/online/online-http.ts",
        "src/main/services/ai-runtime/online/keytar-loader.ts",
        "src/main/services/app-shell/storage-fs.ts",
        // 045 audio: adapter I/O (giải mã audio-decode + transformers.js Whisper + wiring parser) — phủ
        // bởi hàm thuần resample/audio-transcript + thủ công. Loại khỏi ngưỡng.
        "src/main/services/ingestion/audio/decode.ts",
        "src/main/services/ingestion/audio/transcribe.ts",
        "src/main/services/ingestion/parsers/audio.ts",
        // 049 audio-player: handler stream file gốc qua giao thức iv-media:// (node:fs + electron
        // protocol). Hàm thuần tách ở media-range.ts (đã tính coverage). Loại wiring I/O.
        "src/main/services/source-viewer/media-serve.ts",
        // 051 video: spawn ffmpeg I/O (mock trong extract-audio.test.ts, không tính ngưỡng).
        "src/main/services/ingestion/video/extract-audio.ts",
        // 053 image: OCR worker tesseract.js I/O (verify Node + manual; hàm thuần ở image-transcript).
        "src/main/services/ingestion/image/ocr.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
