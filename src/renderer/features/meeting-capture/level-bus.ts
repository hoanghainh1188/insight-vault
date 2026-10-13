// 186 PR B — kênh mức âm lượng micro (100 ms) từ capture tới LevelMeter, KHÔNG qua state React của RecordingProvider (tránh
// render lại cả cây 10 lần/giây). Biên độ 0..1 ⇒ dBFS.

export interface LevelSample {
  rmsDbfs: number;
  peakDbfs: number;
}

type Listener = (s: LevelSample) => void;

let listeners: readonly Listener[] = [];

const toDb = (amp: number): number =>
  amp > 0 ? 20 * Math.log10(amp) : Number.NEGATIVE_INFINITY;

export function publishLevel(level: { rms: number; peak: number }): void {
  const sample = { rmsDbfs: toDb(level.rms), peakDbfs: toDb(level.peak) };
  for (const l of listeners) l(sample);
}

export function subscribeLevel(fn: Listener): () => void {
  listeners = [...listeners, fn];
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}
