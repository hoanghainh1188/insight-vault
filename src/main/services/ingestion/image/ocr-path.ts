import { existsSync } from "node:fs";
import { dirname } from "node:path";

// Resolve thư mục core WASM của tesseract.js (053). Dev: node_modules; đóng gói: binary/wasm ngoài asar
// (electron-builder asarUnpack) → thay `app.asar` → `app.asar.unpacked`. Tách khỏi electron `app` (nhận
// isPackaged qua tham số) để unit-test. Đối xứng ffmpeg-path 051.

/** Thuần: đổi path theo trạng thái đóng gói. */
export function resolveCorePathFrom(
  rawDir: string,
  isPackaged: boolean,
): string {
  return isPackaged ? rawDir.replace("app.asar", "app.asar.unpacked") : rawDir;
}

/** Thư mục tesseract.js-core (chứa *.wasm) cho corePath. Fail-fast nếu thiếu (đóng gói lệch). */
export function resolveCorePath(isPackaged: boolean): string {
  // require.resolve trỏ tới entry của tesseract.js-core → lấy thư mục chứa.
  const raw = dirname(require.resolve("tesseract.js-core/package.json"));
  const dir = resolveCorePathFrom(raw, isPackaged);
  if (!existsSync(dir)) {
    throw new Error("Không tìm thấy tesseract.js-core (đóng gói lệch?)");
  }
  return dir;
}
