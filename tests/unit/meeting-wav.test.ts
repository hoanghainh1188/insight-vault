import { describe, it, expect } from "vitest";
import {
  WAV_HEADER_BYTES,
  buildWavHeader,
  liveWavParts,
  repairWavHeader,
} from "../../src/main/services/meeting-capture/wav";

// 186 — header WAV PCM (R3): dựng khi đóng phân đoạn, sửa khi khôi phục sau sự cố. Hàm thuần.

const ascii = (b: Uint8Array, at: number, n: number): string =>
  String.fromCharCode(...b.subarray(at, at + n));
const view = (b: Uint8Array): DataView =>
  new DataView(b.buffer, b.byteOffset, b.byteLength);

describe("buildWavHeader", () => {
  it("44 byte RIFF/WAVE/fmt/data đúng cho PCM16 16 kHz mono", () => {
    const h = buildWavHeader(32000);
    expect(h.byteLength).toBe(WAV_HEADER_BYTES);
    const v = view(h);
    expect(ascii(h, 0, 4)).toBe("RIFF");
    expect(v.getUint32(4, true)).toBe(36 + 32000);
    expect(ascii(h, 8, 4)).toBe("WAVE");
    expect(ascii(h, 12, 4)).toBe("fmt ");
    expect(v.getUint32(16, true)).toBe(16);
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(22, true)).toBe(1); // mono
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint32(28, true)).toBe(32000); // byte rate
    expect(v.getUint16(32, true)).toBe(2); // block align
    expect(v.getUint16(34, true)).toBe(16);
    expect(ascii(h, 36, 4)).toBe("data");
    expect(v.getUint32(40, true)).toBe(32000);
  });

  it("tham số khác (stereo 48 kHz) tính byte rate / block align đúng", () => {
    const v = view(buildWavHeader(0, 48000, 2, 16));
    expect(v.getUint32(28, true)).toBe(48000 * 4);
    expect(v.getUint16(32, true)).toBe(4);
  });

  it("dataBytes = 0 hợp lệ (phân đoạn vừa mở)", () => {
    const v = view(buildWavHeader(0));
    expect(v.getUint32(4, true)).toBe(36);
    expect(v.getUint32(40, true)).toBe(0);
  });

  it("từ chối dataBytes âm / không nguyên", () => {
    expect(() => buildWavHeader(-1)).toThrow();
    expect(() => buildWavHeader(1.5)).toThrow();
  });
});

describe("repairWavHeader", () => {
  it("tính độ dài data từ kích thước tệp (header 44 byte)", () => {
    const r = repairWavHeader(44 + 32000);
    expect(r.dataBytes).toBe(32000);
    expect(view(r.header).getUint32(40, true)).toBe(32000);
  });

  it("cắt byte lẻ (mẫu ghi dở khi sập)", () => {
    expect(repairWavHeader(44 + 32001).dataBytes).toBe(32000);
  });

  it("tệp ngắn hơn header ⇒ data rỗng hợp lệ", () => {
    expect(repairWavHeader(0).dataBytes).toBe(0);
    expect(repairWavHeader(20).dataBytes).toBe(0);
    expect(repairWavHeader(44).dataBytes).toBe(0);
  });
});

describe("liveWavParts (PR B — phát lại phân đoạn đang ghi)", () => {
  it("tổng = 44 + dữ liệu chẵn; header dựng lại theo kích thước hiện tại", () => {
    const p = liveWavParts(44 + 101, 0, 44 + 100 - 1);
    expect(p.total).toBe(144);
    expect(view(p.header).getUint32(40, true)).toBe(100);
    expect(p.headerSlice).toEqual([0, 44]);
    expect(p.fileSlice).toEqual([44, 143]);
  });

  it("Range chỉ trong header / chỉ trong dữ liệu / vắt qua", () => {
    expect(liveWavParts(1044, 4, 7)).toMatchObject({
      headerSlice: [4, 8],
      fileSlice: null,
    });
    expect(liveWavParts(1044, 100, 199)).toMatchObject({
      headerSlice: null,
      fileSlice: [100, 199],
    });
    expect(liveWavParts(1044, 40, 50)).toMatchObject({
      headerSlice: [40, 44],
      fileSlice: [44, 50],
    });
  });

  it("tệp ngắn hơn header ⇒ chỉ có header (dữ liệu rỗng)", () => {
    const p = liveWavParts(10, 0, 43);
    expect(p.total).toBe(WAV_HEADER_BYTES);
    expect(p.fileSlice).toBeNull();
  });
});
