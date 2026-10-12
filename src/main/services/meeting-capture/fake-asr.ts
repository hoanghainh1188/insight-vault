import type { Segment } from "../ingestion/audio/audio-transcript";

// 186 — ASR GIẢ tất định cho e2e (IV_ASR_FAKE, chỉ khi chưa đóng gói — R15). THUẦN.
// Mỗi cửa sổ 10 s có tín hiệu (RMS > −40 dBFS) ⇒ segment "đoạn <n>" (n đếm từ 1 theo vị trí cửa sổ); thời gian tương đối
// đầu vào. Không dùng model, không I/O.

const WINDOW_SEC = 10;
const SPEECH_RMS = 0.01; // ≈ −40 dBFS

export function fakeTranscribe(pcm: Int16Array, sampleRate: number): Segment[] {
  const win = WINDOW_SEC * sampleRate;
  const out: Segment[] = [];
  for (let start = 0, n = 1; start < pcm.length; start += win, n++) {
    const end = Math.min(pcm.length, start + win);
    let sumSq = 0;
    for (let i = start; i < end; i++) {
      const s = (pcm[i] ?? 0) / 0x8000;
      sumSq += s * s;
    }
    if (Math.sqrt(sumSq / (end - start)) > SPEECH_RMS) {
      out.push({
        text: `đoạn ${n}`,
        tStart: start / sampleRate,
        tEnd: end / sampleRate,
      });
    }
  }
  return out;
}
