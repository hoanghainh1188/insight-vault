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
        "src/renderer/shared/useModalA11y.ts",
        "src/renderer/shared/lastNotebook.ts",
        "src/renderer/shared/markdown/remark-cite.ts",
        "src/renderer/features/sources/useColumnWidths.ts",
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
