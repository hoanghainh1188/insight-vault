import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { extractAudioTo16kWav } from "../../src/main/services/ingestion/video/extract-audio";

// Fake ChildProcess: stderr là EventEmitter; proc emit 'close'/'error'. Điều khiển tất định trong test.
class FakeProc extends EventEmitter {
  stderr = new EventEmitter();
  // Mô phỏng kill → OS phát 'close' (code null) như tiến trình thật bị SIGKILL.
  kill = vi.fn(() => {
    this.emit("close", null);
  });
}

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "iv-extract-"));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function run(
  onSpawn: (proc: FakeProc, outPath: string) => void,
): Promise<string | null> {
  const uuid = () => "fixed";
  const outPath = join(dir, "fixed.wav");
  const proc = new FakeProc();
  const spawn = (() => proc) as never;
  const p = extractAudioTo16kWav("in.mp4", dir, {
    ffmpegPath: "ffmpeg",
    uuid,
    spawn,
  });
  // Sau khi handler đã đăng ký (đồng bộ trong hàm), kích hoạt kịch bản.
  onSpawn(proc, outPath);
  return p;
}

describe("extractAudioTo16kWav (051)", () => {
  it("exit 0 + file out có dữ liệu → trả path", async () => {
    const res = await run((proc, outPath) => {
      writeFileSync(outPath, Buffer.from("RIFFxxxxWAVE")); // size > 0
      proc.emit("close", 0);
    });
    expect(res).toBe(join(dir, "fixed.wav"));
  });

  it("video KHÔNG có audio (stderr 'does not contain any stream', exit 1) → null (không ném)", async () => {
    const res = await run((proc, outPath) => {
      proc.stderr.emit(
        "data",
        Buffer.from("Output file #0 does not contain any stream"),
      );
      proc.emit("close", 1);
      // out không được tạo → dọn không cần
      expect(existsSync(outPath)).toBe(false);
    });
    expect(res).toBeNull();
  });

  it("lỗi thật (exit 1, stderr khác) → ném", async () => {
    await expect(
      run((proc) => {
        proc.stderr.emit("data", Buffer.from("Invalid data found"));
        proc.emit("close", 1);
      }),
    ).rejects.toThrow(/ffmpeg/i);
  });

  it("ffmpeg không spawn được (event error) → ném", async () => {
    await expect(
      run((proc) => proc.emit("error", new Error("ENOENT"))),
    ).rejects.toThrow(/ENOENT/);
  });

  it("ffmpeg treo quá timeout → kill + ném (security #3)", async () => {
    const proc = new FakeProc();
    const spawn = (() => proc) as never;
    const p = extractAudioTo16kWav("in.mp4", dir, {
      ffmpegPath: "ffmpeg",
      uuid: () => "to",
      spawn,
      timeoutMs: 20,
    });
    await expect(p).rejects.toThrow(/quá thời gian/);
    expect(proc.kill).toHaveBeenCalled();
  });
});
