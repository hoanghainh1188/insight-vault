import { MEETING_SAMPLE_RATE } from "@shared/meeting/constants";
import workletUrl from "./pcm-worklet.ts?worker&url";

// 186 — thu micro ở renderer (I/O, research R1/R4). getUserMedia → AudioContext 16 kHz (Chromium tự resample từ tần số
// gốc — spike S1) → AudioWorklet "pcm-capture" → lô PCM16 1 s qua onBatch. Không giữ/ghi audio ở renderer: lô chuyển
// ngay sang main (kênh meeting:audio). `stop()` xả lô lẻ rồi TẮT track thật (chỉ báo micro của hệ điều hành tắt — D11).
// Chế độ thử (`fakeTone`, chỉ khi main báo bản chưa đóng gói chạy e2e): thay micro bằng oscillator qua CÙNG chuỗi
// AudioContext/worklet — e2e không phụ thuộc quyền micro của hệ điều hành (spike S1: cờ fake audio của Chromium treo).

export interface MicCapture {
  /** Xả lô lẻ (gửi qua onBatch) rồi dừng track + đóng AudioContext. Idempotent. */
  stop(): Promise<void>;
  /** Nhãn thiết bị đang dùng (rỗng nếu trình duyệt chưa cấp nhãn). */
  deviceLabel: string;
}

export type MicErrorCode = "denied" | "notFound" | "failed";

export class MicError extends Error {
  constructor(readonly code: MicErrorCode) {
    super(code);
    this.name = "MicError";
  }
}

export interface MicCaptureOptions {
  deviceId?: string;
  fakeTone?: boolean;
  onBatch(pcm: ArrayBuffer, level: { rms: number; peak: number }): void;
  /** Mức âm lượng mỗi 100 ms (biên độ 0..1) cho meter — PR B. */
  onLevel?(level: { rms: number; peak: number }): void;
  /** Track kết thúc ngoài ý muốn (rút thiết bị, mất quyền). */
  onEnded(): void;
}

type WorkletMsg =
  | { type: "batch"; pcm: ArrayBuffer; rms: number; peak: number }
  | { type: "level"; rms: number; peak: number }
  | { type: "flushed" };

function toMicError(e: unknown): MicError {
  const name = e instanceof DOMException || e instanceof Error ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return new MicError("denied");
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return new MicError("notFound");
  return new MicError("failed");
}

export async function startMicCapture(
  opts: MicCaptureOptions,
): Promise<MicCapture> {
  let stream: MediaStream | null = null;
  if (!opts.fakeTone) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(opts.deviceId ? { deviceId: { exact: opts.deviceId } } : {}),
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (e) {
      throw toMicError(e);
    }
  }
  const ctx = new AudioContext({ sampleRate: MEETING_SAMPLE_RATE });
  let stopped = false;
  try {
    await ctx.audioWorklet.addModule(workletUrl);
  } catch {
    stream?.getTracks().forEach((t) => t.stop());
    await ctx.close().catch(() => undefined);
    throw new MicError("failed");
  }
  const node = new AudioWorkletNode(ctx, "pcm-capture");
  let onFlushed: (() => void) | null = null;
  node.port.onmessage = (e: MessageEvent<WorkletMsg>) => {
    if (e.data.type === "batch")
      opts.onBatch(e.data.pcm, { rms: e.data.rms, peak: e.data.peak });
    else if (e.data.type === "level")
      opts.onLevel?.({ rms: e.data.rms, peak: e.data.peak });
    else if (e.data.type === "flushed") onFlushed?.();
  };

  let source: AudioNode;
  if (stream) {
    source = ctx.createMediaStreamSource(stream);
    const track = stream.getAudioTracks()[0];
    track?.addEventListener("ended", () => {
      if (!stopped) opts.onEnded();
    });
  } else {
    // Tín hiệu thử: 440 Hz bật/tắt mỗi 10 s (có cả cửa sổ "im lặng" cho ASR giả).
    const osc = ctx.createOscillator();
    osc.frequency.value = 440;
    const gain = ctx.createGain();
    gain.gain.value = 0.3;
    for (let t = 10; t < 4 * 3600; t += 20) {
      gain.gain.setValueAtTime(0, ctx.currentTime + t);
      gain.gain.setValueAtTime(0.3, ctx.currentTime + t + 10);
    }
    osc.connect(gain);
    osc.start();
    source = gain;
  }
  source.connect(node);
  const deviceLabel = stream?.getAudioTracks()[0]?.label ?? "";

  return {
    deviceLabel,
    async stop() {
      if (stopped) return;
      stopped = true;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 1000); // worklet không phản hồi ⇒ không chặn kết thúc
        onFlushed = () => {
          clearTimeout(timer);
          resolve();
        };
        node.port.postMessage({ type: "flush" });
      });
      source.disconnect();
      node.disconnect();
      stream?.getTracks().forEach((t) => t.stop());
      await ctx.close().catch(() => undefined);
    },
  };
}
