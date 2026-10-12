import { SAMPLE_RATE } from "./meeting-constants";

// 186 — header WAV PCM 44 byte (R3). THUẦN: dựng khi đóng phân đoạn; sửa khi khôi phục (độ dài suy từ kích thước tệp).

export const WAV_HEADER_BYTES = 44;

export function buildWavHeader(
  dataBytes: number,
  sampleRate = SAMPLE_RATE,
  channels = 1,
  bitsPerSample = 16,
): Uint8Array {
  if (!Number.isInteger(dataBytes) || dataBytes < 0) {
    throw new RangeError("dataBytes must be a non-negative integer");
  }
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = new Uint8Array(WAV_HEADER_BYTES);
  const v = new DataView(header.buffer);
  const ascii = (at: number, s: string): void => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true); // kích thước khối fmt (PCM)
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * blockAlign, true);
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, bitsPerSample, true);
  ascii(36, "data");
  v.setUint32(40, dataBytes, true);
  return header;
}

/** Header đúng cho một tệp PCM16 mono đã ghi dở (sập giữa chừng): bỏ mẫu ghi dở cuối. */
export function repairWavHeader(fileSize: number): {
  dataBytes: number;
  header: Uint8Array;
} {
  const raw = Math.max(0, Math.floor(fileSize) - WAV_HEADER_BYTES);
  const dataBytes = raw - (raw % 2);
  return { dataBytes, header: buildWavHeader(dataBytes) };
}
