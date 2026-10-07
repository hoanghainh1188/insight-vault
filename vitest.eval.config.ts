import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// 108: công cụ đo truy xuất (dev-only) — `npm run eval:retrieval`. Tách khỏi `npm test`: chạy mô hình e5 thật
// + LanceDB/FTS5 thật trên thư mục tạm, chậm (phút) và cần tải mô hình lần đầu. KHÔNG tính coverage.
export default defineConfig({
  resolve: { alias: { "@shared": resolve("src/shared") } },
  test: {
    environment: "node",
    include: ["tests/eval/**/*.eval.ts"],
    testTimeout: 30 * 60 * 1000,
    hookTimeout: 30 * 60 * 1000,
    coverage: { enabled: false },
  },
});
