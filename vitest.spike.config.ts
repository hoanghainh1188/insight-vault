import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// 186 spike S2: đo RTF Whisper + phát hiện ngôn ngữ (dev-only) — `npm run spike:asr`. Tách khỏi `npm test`/CI: tải model thật
// từ HuggingFace lần đầu (vào tests/spike/.cache), chạy vài phút. KHÔNG tính coverage.
export default defineConfig({
  resolve: { alias: { "@shared": resolve("src/shared") } },
  test: {
    environment: "node",
    include: ["tests/spike/**/*.spike.ts"],
    testTimeout: 60 * 60 * 1000,
    hookTimeout: 30 * 60 * 1000,
    fileParallelism: false,
    coverage: { enabled: false },
  },
});
