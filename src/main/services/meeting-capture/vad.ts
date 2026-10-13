import { SAMPLE_RATE } from "./meeting-constants";

// 186 PR B — VAD theo năng lượng (research R6). THUẦN. Cửa sổ chỉ có im lặng/nhiễu nền không gửi ASR: Whisper hay "ảo giác" câu
// kết thúc video trên im lặng. Khung 30 ms; cửa sổ có lời khi tỉ lệ khung vượt ngưỡng ≥ minSpeechRatio.

const FRAME_MS = 30;
const FRAME = Math.round((SAMPLE_RATE * FRAME_MS) / 1000);

/** Năng lượng RMS của một khung PCM16, dBFS (0 = toàn thang); im lặng tuyệt đối ⇒ -Infinity. */
export function frameDbfs(frame: Int16Array): number {
  if (frame.length === 0) return Number.NEGATIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < frame.length; i++) {
    const v = (frame[i] ?? 0) / 32768;
    sum += v * v;
  }
  return 10 * Math.log10(sum / frame.length);
}

export function isSpeechWindow(
  pcm: Int16Array,
  thresholdDbfs = -45,
  minSpeechRatio = 0.1,
): boolean {
  const frames = Math.floor(pcm.length / FRAME);
  if (frames === 0) return false;
  let speech = 0;
  for (let f = 0; f < frames; f++) {
    if (frameDbfs(pcm.subarray(f * FRAME, (f + 1) * FRAME)) > thresholdDbfs)
      speech++;
  }
  return speech / frames >= minSpeechRatio;
}
