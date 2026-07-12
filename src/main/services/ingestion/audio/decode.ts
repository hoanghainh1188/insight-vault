import audioDecode from "audio-decode";

// Giải mã file audio → PCM float32 mono (kênh 0) + sample rate gốc (045). I/O — loại khỏi coverage.
// audio-decode tự nhận định dạng từ bytes (wav/mp3/flac/ogg). Resample về 16kHz do resample.ts (thuần).

export interface DecodedAudio {
  samples: Float32Array; // kênh 0 (mono)
  sampleRate: number;
}

/** Định dạng audio hỗ trợ ở 2a (m4a/aac cần ffmpeg → 2b). */
export const SUPPORTED_AUDIO_EXT = ["wav", "mp3", "flac", "ogg"] as const;

export async function decodeAudio(bytes: Uint8Array): Promise<DecodedAudio> {
  const audioBuffer = await audioDecode(Buffer.from(bytes));
  const ch0 = audioBuffer.channelData[0];
  if (!ch0 || ch0.length === 0) {
    throw new Error(
      "File audio không giải mã được (không có dữ liệu âm thanh).",
    );
  }
  return { samples: ch0, sampleRate: audioBuffer.sampleRate };
}
