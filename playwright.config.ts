import { defineConfig } from "@playwright/test";

// E2e cho Electron dùng `_electron` (import trong từng spec). Cần app đã build (out/) + môi trường có display.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
});
