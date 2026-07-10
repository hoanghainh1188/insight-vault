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
        "src/main/logging.ts",
        "src/shared/ipc/**/*.ts",
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
