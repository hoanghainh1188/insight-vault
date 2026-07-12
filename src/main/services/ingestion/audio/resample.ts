// Resample PCM về 16kHz mono cho Whisper (045). THUẦN — unit-test được. Nội suy tuyến tính (đủ cho giọng
// nói; Whisper bền với chất lượng resample). srcRate=16000 → trả nguyên.

export const TARGET_RATE = 16000;

export function resampleTo16k(
  samples: Float32Array,
  srcRate: number,
): Float32Array {
  if (srcRate === TARGET_RATE) return samples;
  if (srcRate <= 0 || samples.length === 0) return new Float32Array(0);
  const ratio = TARGET_RATE / srcRate;
  const outLen = Math.max(1, Math.round(samples.length * ratio));
  const out = new Float32Array(outLen);
  const lastIdx = samples.length - 1;
  for (let i = 0; i < outLen; i++) {
    const srcPos = i / ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, lastIdx);
    const frac = srcPos - i0;
    out[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
  }
  return out;
}
