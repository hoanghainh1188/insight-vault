// 186 — AudioWorkletProcessor "pcm-capture" (research R1/R4, kết quả spike S1). Chạy trong AudioWorkletGlobalScope (luồng
// audio): Float32 → Int16, gom lô 16 000 mẫu (= 1 s ở 16 kHz), chuyển ArrayBuffer (transfer, không chép) về luồng chính.
// Kèm RMS/peak của lô cho meter (PR B). Lệnh `flush` (khi tạm dừng/kết thúc) gửi nốt lô lẻ rồi báo `flushed` —
// spike S1 cho thấy bỏ qua bước này mất phần < 1 s cuối. Nạp bằng `?worker&url` (Vite biên dịch → tệp JS cùng origin, hợp
// CSP `script-src 'self'`). KHÔNG import gì: tệp này chạy độc lập.

declare const sampleRate: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

const BATCH = 16000;
/** Mức âm lượng cho meter mỗi 100 ms (1 600 mẫu ở 16 kHz) — PR B, FR-024. */
const LEVEL_EVERY = 1600;

class PcmCaptureProcessor extends AudioWorkletProcessor {
  private buf = new Int16Array(BATCH);
  private n = 0;
  private sumSq = 0;
  private peak = 0;
  private levelN = 0;
  private levelSumSq = 0;
  private levelPeak = 0;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<{ type?: string }>) => {
      if (e.data?.type === "flush") {
        this.emit();
        this.port.postMessage({ type: "flushed" });
      }
    };
  }

  private emit(): void {
    if (this.n === 0) return;
    const pcm = this.buf.slice(0, this.n).buffer;
    this.port.postMessage(
      {
        type: "batch",
        pcm,
        rms: Math.sqrt(this.sumSq / this.n),
        peak: this.peak,
        sampleRate,
      },
      [pcm],
    );
    this.buf = new Int16Array(BATCH);
    this.n = 0;
    this.sumSq = 0;
    this.peak = 0;
  }

  process(inputs: Float32Array[][]): boolean {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i] ?? 0));
      this.sumSq += s * s;
      const a = Math.abs(s);
      if (a > this.peak) this.peak = a;
      this.levelSumSq += s * s;
      if (a > this.levelPeak) this.levelPeak = a;
      if (++this.levelN === LEVEL_EVERY) {
        this.port.postMessage({
          type: "level",
          rms: Math.sqrt(this.levelSumSq / this.levelN),
          peak: this.levelPeak,
        });
        this.levelN = 0;
        this.levelSumSq = 0;
        this.levelPeak = 0;
      }
      this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === BATCH) this.emit();
    }
    return true;
  }
}

registerProcessor("pcm-capture", PcmCaptureProcessor);
