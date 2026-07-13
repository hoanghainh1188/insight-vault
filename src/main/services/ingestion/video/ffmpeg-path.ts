import { existsSync } from "node:fs";
import ffmpegStatic from "ffmpeg-static";

// Resolve đường dẫn binary ffmpeg (051). Dev: path node_modules do ffmpeg-static export. Đóng gói:
// binary nằm ngoài asar (electron-builder asarUnpack) → thay `app.asar` → `app.asar.unpacked`.
// Tách khỏi electron `app` (nhận isPackaged qua tham số) để unit-test được.

/** Thuần: đổi path theo trạng thái đóng gói. Ném nếu ffmpeg-static không khả dụng (nền tảng lạ). */
export function resolveFfmpegPathFrom(
  rawPath: string | null,
  isPackaged: boolean,
): string {
  if (!rawPath) {
    throw new Error("ffmpeg-static không khả dụng trên nền tảng này");
  }
  return isPackaged
    ? rawPath.replace("app.asar", "app.asar.unpacked")
    : rawPath;
}

/** Path binary ffmpeg thực tế cho runtime. Fail-fast nếu binary không tồn tại (packaging lệch — security #1). */
export function resolveFfmpegPath(isPackaged: boolean): string {
  const p = resolveFfmpegPathFrom(
    ffmpegStatic as unknown as string | null,
    isPackaged,
  );
  if (!existsSync(p)) {
    throw new Error("Không tìm thấy binary ffmpeg (đóng gói lệch?)");
  }
  return p;
}
