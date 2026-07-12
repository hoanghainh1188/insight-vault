// Hàm THUẦN cho giao thức iv-media:// (049, Pha 2a-player) — tách khỏi media-serve.ts (I/O) để test
// được và tính vào ngưỡng coverage. Không phụ thuộc node:fs/electron.

const AUDIO_MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  ogg: "audio/ogg",
};

/** Đuôi file (chữ thường, không có dấu chấm) từ đường dẫn; "" nếu không có. */
export function extOf(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot < 0 || dot === path.length - 1) return "";
  return path.slice(dot + 1).toLowerCase();
}

/** MIME theo đuôi file audio; mặc định audio/mpeg. */
export function mimeForAudioExt(ext: string): string {
  return AUDIO_MIME[ext.toLowerCase()] ?? "audio/mpeg";
}

/**
 * Parse header "Range: bytes=start-end" → {start,end} đã kẹp trong [0,size). null nếu không hợp lệ.
 * Hỗ trợ "bytes=start-", "bytes=start-end", suffix "bytes=-N" (N byte cuối).
 */
export function parseRange(
  header: string | null,
  size: number,
): { start: number; end: number } | null {
  if (!header || size <= 0) return null;
  const m = /bytes=(\d*)-(\d*)/.exec(header);
  if (!m) return null;
  const hasStart = m[1] !== "";
  const hasEnd = m[2] !== "";
  if (!hasStart && !hasEnd) return null; // "bytes=-" vô nghĩa
  let start = hasStart ? parseInt(m[1], 10) : 0;
  let end = hasEnd ? parseInt(m[2], 10) : size - 1;
  if (!hasStart && hasEnd) {
    // suffix "bytes=-N" → N byte cuối
    start = Math.max(0, size - parseInt(m[2], 10));
    end = size - 1;
  }
  if (
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    start > end ||
    start >= size
  ) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}
