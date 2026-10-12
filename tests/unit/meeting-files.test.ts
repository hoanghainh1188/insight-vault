import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  existsSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createMeetingFiles } from "../../src/main/services/meeting-capture/meeting-files";
import {
  segmentFileName,
  type SegmentRecord,
} from "../../src/main/services/meeting-capture/segments";

// 186 — I/O tệp phiên ghi trên thư mục tạm THẬT (R3, R8, D9): writer WAV tăng dần, sửa header sau sự cố, ghép
// meeting.wav, checkpoint kết quả chốt, xoá. Hằng số fsync nhỏ để test nhanh.

const SID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "iv-meet-files-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const pcm = (bytes: number, fill = 1): Uint8Array =>
  new Uint8Array(bytes).fill(fill);
const dataLen = (p: string): number => readFileSync(p).readUInt32LE(40);

describe("writer", () => {
  it("append + close ⇒ WAV hợp lệ, header đúng độ dài", async () => {
    const f = createMeetingFiles(join(root, "meetings"), { fsyncSec: 1 });
    await f.ensureSessionDir(SID);
    const w = f.openWriter(SID, 0, () => undefined);
    w.append(pcm(32000));
    w.append(pcm(16000, 2));
    expect(w.samples()).toBe(24000);
    expect(await w.close()).toBe(24000);
    const p = f.segmentPath(SID, 0);
    expect(statSync(p).size).toBe(44 + 48000);
    expect(readFileSync(p).toString("ascii", 0, 4)).toBe("RIFF");
    expect(dataLen(p)).toBe(48000);
  });
});

describe("repairSegments (sau sự cố)", () => {
  it("phân đoạn đang mở có header 0 ⇒ sửa theo kích thước tệp; phân đoạn mất ⇒ 0 mẫu", async () => {
    const f = createMeetingFiles(join(root, "meetings"), { fsyncSec: 1 });
    await f.ensureSessionDir(SID);
    const w0 = f.openWriter(SID, 0, () => undefined);
    w0.append(pcm(3200));
    await w0.close();
    // Mô phỏng sập: tệp có header 0 + dữ liệu (+1 byte dở).
    const header0 = Buffer.alloc(44);
    header0.write("RIFF", 0);
    writeFileSync(
      f.segmentPath(SID, 1),
      Buffer.concat([header0, Buffer.alloc(6401, 5)]),
    );
    const segs: SegmentRecord[] = [
      { index: 0, file: segmentFileName(0), samples: 1600, closed: true },
      { index: 1, file: segmentFileName(1), samples: 100, closed: false },
      { index: 2, file: segmentFileName(2), samples: 50, closed: false },
    ];
    const repaired = await f.repairSegments(SID, segs);
    expect(repaired).toEqual([
      { index: 0, file: "seg-0000.wav", samples: 1600, closed: true },
      { index: 1, file: "seg-0001.wav", samples: 3200, closed: true },
      { index: 2, file: "seg-0002.wav", samples: 0, closed: true },
    ]);
    expect(dataLen(f.segmentPath(SID, 1))).toBe(6400);
  });
});

describe("ghép, checkpoint, xoá", () => {
  it("mergeSegments ⇒ meeting.wav = nối dữ liệu các phân đoạn, header tổng", async () => {
    const f = createMeetingFiles(join(root, "meetings"), { fsyncSec: 1 });
    await f.ensureSessionDir(SID);
    const segs: SegmentRecord[] = [];
    for (let i = 0; i < 3; i++) {
      const w = f.openWriter(SID, i, () => undefined);
      w.append(pcm(1000 * (i + 1), i + 1));
      segs.push({
        index: i,
        file: segmentFileName(i),
        samples: await w.close(),
        closed: true,
      });
    }
    await f.mergeSegments(SID, segs);
    const merged = readFileSync(f.mergedPath(SID));
    expect(merged.readUInt32LE(40)).toBe(6000);
    expect(merged.length).toBe(44 + 6000);
    expect(merged[44]).toBe(1);
    expect(merged[44 + 1000]).toBe(2);
    expect(merged[44 + 3000]).toBe(3);
    expect(f.hasMerged(SID)).toBe(true);

    await f.deleteSegments(SID, segs);
    expect(existsSync(f.segmentPath(SID, 0))).toBe(false);
    expect(existsSync(f.mergedPath(SID))).toBe(true);
  });

  it("writeFinal / readFinal khứ hồi; JSON hỏng hoặc thiếu ⇒ null", async () => {
    const f = createMeetingFiles(join(root, "meetings"), { fsyncSec: 1 });
    await f.ensureSessionDir(SID);
    expect(await f.readFinal(SID, 0)).toBeNull();
    await f.writeFinal(SID, 0, [{ text: "xin chào", tStart: 1, tEnd: 2 }]);
    expect(await f.readFinal(SID, 0)).toEqual([
      { text: "xin chào", tStart: 1, tEnd: 2 },
    ]);
    writeFileSync(
      join(root, "meetings", SID, "final", "seg-0001.json"),
      "{hỏng",
    );
    expect(await f.readFinal(SID, 1)).toBeNull();
    writeFileSync(
      join(root, "meetings", SID, "final", "seg-0002.json"),
      '[{"text":1}]',
    );
    expect(await f.readFinal(SID, 2)).toBeNull();
  });

  it("deleteSession xoá cả thư mục; idempotent", async () => {
    const f = createMeetingFiles(join(root, "meetings"), { fsyncSec: 1 });
    await f.ensureSessionDir(SID);
    await f.deleteSession(SID);
    expect(existsSync(join(root, "meetings", SID))).toBe(false);
    await expect(f.deleteSession(SID)).resolves.toBeUndefined();
  });

  it("sessionId lạ (thoát thư mục) ⇒ ném, không đụng tệp", async () => {
    const f = createMeetingFiles(join(root, "meetings"), { fsyncSec: 1 });
    await expect(f.ensureSessionDir("../escape")).rejects.toThrow();
    expect(() => f.segmentPath("../../x", 0)).toThrow();
    await expect(f.deleteSession("..")).rejects.toThrow();
  });
});
