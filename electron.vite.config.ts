import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

// Inject CSP meta theo môi trường (Constitution I / R7). file:// prod không kích hoạt onHeadersReceived
// đáng tin, nên meta tag là cơ chế chuẩn cho bản đóng gói.
// - dev: nới ws/http localhost cho HMR Vite.
// - prod: chặt — không network client-side (mọi network đi qua main qua IPC).
function cspPlugin(): Plugin {
  const DEV =
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:* http://localhost:*; img-src 'self' data:; font-src 'self'";
  const PROD =
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'";
  return {
    name: "insightvault-csp",
    transformIndexHtml(html, ctx) {
      const csp = ctx.server ? DEV : PROD;
      return html.replace(
        "<!--CSP-->",
        `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      );
    },
  };
}

// 3 target: main (Node) / preload / renderer (React). Ranh giới bảo mật ở BrowserWindow (src/main/index.ts).
export default defineConfig({
  main: {
    build: {
      rollupOptions: { input: { index: resolve("src/main/index.ts") } },
    },
    resolve: { alias: { "@shared": resolve("src/shared") } },
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: resolve("src/preload/index.ts") },
        // sandbox:true ⇒ preload PHẢI là CommonJS (Electron không hỗ trợ ESM preload khi sandbox bật).
        output: { format: "cjs", entryFileNames: "[name].cjs" },
      },
    },
    resolve: { alias: { "@shared": resolve("src/shared") } },
  },
  renderer: {
    root: "src/renderer",
    build: {
      rollupOptions: { input: { index: resolve("src/renderer/index.html") } },
    },
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
        "@renderer": resolve("src/renderer"),
      },
    },
    plugins: [react(), cspPlugin()],
  },
});
