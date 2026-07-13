import { spawn as nodeSpawn } from "node:child_process";
import { existsSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

// Tách track audio khỏi video bằng ffmpeg → wav 16kHz mono (051, Constitution III: spawn CHỈ ở main,
// path từ DB không từ renderer, MẢNG THAM SỐ không shell string → chống injection; KHÔNG log path/nội dung).
// I/O wiring — loại coverage; test bằng mock spawn. Phát hiện video KHÔNG audio → trả null (FR-011).

export interface ExtractDeps {
  ffmpegPath: string;
  uuid: () => string;
  /** Cho test: tiêm spawn giả. Mặc định node:child_process spawn. */
  spawn?: typeof nodeSpawn;
  /** Timeout (ms) — ffmpeg treo (file hỏng) sẽ bị kill để không chặn SerialQueue. Mặc định 10 phút. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

// stderr ffmpeg khi output rỗng (video không có audio stream để -vn giữ lại).
const NO_STREAM_RE =
  /does not contain any stream|matches no streams|Output file (#0 )?is empty/i;

/**
 * Tách audio → wav 16kHz mono trong `outDir`. Trả path wav (có audio) | null (không audio track).
 * Ném nếu ffmpeg không chạy được / lỗi thật (pipeline → source error).
 */
export function extractAudioTo16kWav(
  videoPath: string,
  outDir: string,
  deps: ExtractDeps,
): Promise<string | null> {
  const spawn = deps.spawn ?? nodeSpawn;
  const outPath = join(outDir, `${deps.uuid()}.wav`);
  const args = [
    "-nostdin",
    "-i",
    videoPath,
    "-vn", // bỏ video, chỉ giữ audio
    "-ac",
    "1", // mono
    "-ar",
    "16000", // 16kHz (input Whisper 045)
    "-f",
    "wav",
    "-y",
    outPath,
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn(deps.ffmpegPath, args);
    let stderr = "";
    let timedOut = false;
    // Kill nếu ffmpeg treo (file hỏng/metadata sai) → giải phóng SerialQueue (security review #3).
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    proc.stderr?.on("data", (d: Buffer) => {
      // Giữ tối đa 8KB stderr để phát hiện no-stream; KHÔNG log ra ngoài (có thể chứa path).
      if (stderr.length < 8192) stderr += d.toString();
    });
    proc.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    }); // ffmpeg không spawn được
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        if (existsSync(outPath)) {
          try {
            unlinkSync(outPath);
          } catch {
            /* bỏ qua */
          }
        }
        reject(new Error("ffmpeg quá thời gian (video có thể bị hỏng)"));
        return;
      }
      const ok =
        code === 0 && existsSync(outPath) && statSync(outPath).size > 0;
      if (ok) {
        resolve(outPath);
        return;
      }
      // Dọn file rác nếu ffmpeg tạo dở.
      if (existsSync(outPath)) {
        try {
          unlinkSync(outPath);
        } catch {
          /* bỏ qua */
        }
      }
      if (NO_STREAM_RE.test(stderr)) {
        resolve(null); // video không có audio → FR-011 (không ném)
        return;
      }
      reject(new Error(`ffmpeg thoát mã ${code}`)); // KHÔNG kèm stderr (tránh lộ path)
    });
  });
}
