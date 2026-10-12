import { open, stat } from "node:fs/promises";
import type { Segment } from "../ingestion/audio/audio-transcript";
import {
  parseMainMessage,
  type MainToWorker,
  type WorkerToMain,
} from "./asr-protocol";
import { fakeTranscribe } from "./fake-asr";
import { SAMPLE_RATE } from "./meeting-constants";
import { WAV_HEADER_BYTES } from "./wav";

// 186 — entry utilityProcess "InsightVault ASR" (research R5). Nhận lệnh từ main qua parentPort (đã kiểm bằng
// parseMainMessage, đường dẫn bắt buộc nằm trong <userData>/meetings/ — argv[2]). Chạy Whisper (transformers.js) TUẦN TỰ;
// lỗi ở đây không ảnh hưởng việc ghi audio ở main. Không log nội dung. Kết quả: thời gian TƯƠNG ĐỐI đầu phân đoạn hiện
// tại (vùng ngữ cảnh lấy từ cuối phân đoạn trước có giá trị âm).

type Port = {
  on(ev: "message", cb: (e: { data: unknown }) => void): void;
  postMessage(m: WorkerToMain): void;
};
const port = (process as unknown as { parentPort: Port }).parentPort;
const meetingsRoot = process.argv[2] ?? "";

interface AsrChunk {
  text: string;
  timestamp: [number | null, number | null];
}
type Pipe = (
  input: Float32Array,
  opts: object,
) => Promise<{ chunks?: AsrChunk[] }>;

let config: Extract<MainToWorker, { type: "init" }> | null = null;
let pipePromise: Promise<Pipe> | null = null;
const cancelled = new Set<string>();
let queue: Promise<void> = Promise.resolve();

async function readPcm(
  path: string,
  lastSeconds?: number,
): Promise<Int16Array> {
  const size = (await stat(path)).size;
  const dataBytes = Math.max(0, size - WAV_HEADER_BYTES);
  const want =
    lastSeconds === undefined
      ? dataBytes
      : Math.min(dataBytes, Math.floor(lastSeconds * SAMPLE_RATE) * 2);
  const start = WAV_HEADER_BYTES + (dataBytes - want);
  const buf = Buffer.alloc(want - (want % 2));
  const fh = await open(path, "r");
  try {
    await fh.read(buf, 0, buf.length, start);
  } finally {
    await fh.close();
  }
  return new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);
}

function loadPipeline(cfg: NonNullable<typeof config>): Promise<Pipe> {
  if (!pipePromise) {
    port.postMessage({ type: "modelDownload", active: true });
    pipePromise = (async () => {
      const tf = await import("@huggingface/transformers");
      tf.env.cacheDir = cfg.cacheDir;
      return (await tf.pipeline(
        "automatic-speech-recognition",
        cfg.finalModel,
      )) as unknown as Pipe;
    })()
      .catch((e: unknown) => {
        pipePromise = null; // lần sau thử lại (vd. có Internet trở lại)
        throw e;
      })
      .finally(() =>
        port.postMessage({ type: "modelDownload", active: false }),
      );
  }
  return pipePromise;
}

async function handleFinal(
  msg: Extract<MainToWorker, { type: "final" }>,
): Promise<void> {
  if (cancelled.delete(msg.reqId)) {
    port.postMessage({ type: "error", reqId: msg.reqId, code: "cancelled" });
    return;
  }
  const cfg = config;
  if (!cfg) {
    port.postMessage({ type: "error", reqId: msg.reqId, code: "asrFailed" });
    return;
  }
  let combined: Int16Array;
  let tailSec = 0;
  try {
    const current = await readPcm(msg.segmentPath);
    const tail =
      msg.prevSegmentPath && msg.overlapSec > 0
        ? await readPcm(msg.prevSegmentPath, msg.overlapSec)
        : new Int16Array(0);
    tailSec = tail.length / SAMPLE_RATE;
    combined = new Int16Array(tail.length + current.length);
    combined.set(tail, 0);
    combined.set(current, tail.length);
  } catch {
    port.postMessage({ type: "error", reqId: msg.reqId, code: "asrFailed" });
    return;
  }

  let segments: Segment[];
  if (cfg.fake) {
    segments = fakeTranscribe(combined, SAMPLE_RATE);
  } else {
    let pipe: Pipe;
    try {
      pipe = await loadPipeline(cfg);
    } catch {
      port.postMessage({
        type: "error",
        reqId: msg.reqId,
        code: "modelMissing",
      });
      return;
    }
    try {
      const f32 = new Float32Array(combined.length);
      for (let i = 0; i < combined.length; i++)
        f32[i] = (combined[i] ?? 0) / 0x8000;
      const out = await pipe(f32, {
        return_timestamps: true,
        chunk_length_s: 30,
        ...(msg.language ? { language: msg.language, task: "transcribe" } : {}),
      });
      segments = (out.chunks ?? [])
        .filter((c) => typeof c.text === "string")
        .map((c) => ({
          text: c.text,
          tStart: c.timestamp?.[0] ?? 0,
          tEnd: c.timestamp?.[1] ?? c.timestamp?.[0] ?? 0,
        }));
    } catch {
      port.postMessage({ type: "error", reqId: msg.reqId, code: "asrFailed" });
      return;
    }
  }
  if (cancelled.delete(msg.reqId)) return;
  port.postMessage({
    type: "result",
    reqId: msg.reqId,
    segments: segments.map((s) => ({
      text: s.text,
      tStart: s.tStart - tailSec,
      tEnd: Math.max(s.tStart, s.tEnd) - tailSec,
    })),
  });
}

port.on("message", (e) => {
  const msg = parseMainMessage(e.data, meetingsRoot);
  if (!msg) return;
  if (msg.type === "init") {
    config = msg;
    port.postMessage({ type: "ready" });
  } else if (msg.type === "cancel") {
    cancelled.add(msg.reqId);
  } else {
    queue = queue.then(() => handleFinal(msg)).catch(() => undefined);
  }
});
