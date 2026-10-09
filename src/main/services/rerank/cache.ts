import { join } from "node:path";

// 153: phân biệt "nạp từ cache" với "tải lần đầu" để Cài đặt hiện đúng chữ và chỉ báo ra mạng chỉ bật khi thật sự tải.
// Bố cục cache của transformers.js (cache_dir + revision): <cacheDir>/<model>/<revision>/… Hàm thuần — I/O tiêm vào.

/** Các tệp transformers.js cần để nạp bộ chấm offline (config, tokenizer, ONNX theo kiến trúc). */
export function rerankerCacheFiles(
  cacheDir: string,
  model: string,
  revision: string,
  modelFile: string,
): string[] {
  const base = join(cacheDir, model, revision);
  return [
    join(base, "config.json"),
    join(base, "tokenizer.json"),
    join(base, "tokenizer_config.json"),
    join(base, "onnx", `${modelFile}.onnx`),
  ];
}

/** Đủ mọi tệp ⇒ đã có cache. Lỗi khi kiểm tra ⇒ false (an toàn: coi như sẽ tải, chỉ báo ra mạng vẫn bật). */
export function isRerankerCached(
  files: readonly string[],
  exists: (path: string) => boolean,
): boolean {
  try {
    return files.every((f) => exists(f));
  } catch {
    return false;
  }
}
