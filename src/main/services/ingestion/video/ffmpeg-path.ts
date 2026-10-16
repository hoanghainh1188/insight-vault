import { existsSync } from "node:fs";
import { join } from "node:path";

// Resolve đường dẫn binary ffmpeg (051). Binary là bản LGPL tối giản tự dựng (scripts/build-ffmpeg-lgpl.sh →
// build/ffmpeg/). Dev: <repo>/build/ffmpeg/; đóng gói: electron-builder extraResources → <Resources>/ffmpeg/.
// Tách khỏi electron `app` (nhận đường dẫn qua tham số) để unit-test được.

/** Tên tệp theo nền tảng (Windows có .exe). */
export function ffmpegBinaryName(platform: NodeJS.Platform): string {
  return platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
}

/** Thuần: path binary theo trạng thái đóng gói. */
export function resolveFfmpegPathFrom(opts: {
  isPackaged: boolean;
  platform: NodeJS.Platform;
  resourcesPath: string;
  projectRoot: string;
}): string {
  const dir = opts.isPackaged
    ? join(opts.resourcesPath, "ffmpeg")
    : join(opts.projectRoot, "build", "ffmpeg");
  return join(dir, ffmpegBinaryName(opts.platform));
}

/** Path binary ffmpeg thực tế cho runtime. Fail-fast nếu binary không tồn tại (packaging lệch — security #1). */
export function resolveFfmpegPath(isPackaged: boolean): string {
  const p = resolveFfmpegPathFrom({
    isPackaged,
    platform: process.platform,
    resourcesPath: process.resourcesPath,
    projectRoot: process.cwd(),
  });
  if (!existsSync(p)) {
    throw new Error(
      "ffmpeg binary not found (run `npm run ffmpeg:build`, or packaging mismatch?)",
    );
  }
  return p;
}
