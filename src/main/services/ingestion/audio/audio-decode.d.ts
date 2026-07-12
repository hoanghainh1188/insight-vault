// Khai báo type tối thiểu cho audio-decode (không ship .d.ts). Trả AudioBuffer-like (Node).
declare module "audio-decode" {
  interface DecodedAudioBuffer {
    sampleRate: number;
    /** Mảng kênh; mỗi kênh là Float32Array PCM. */
    channelData: Float32Array[];
  }
  export default function audioDecode(
    buffer: Uint8Array | ArrayBuffer | Buffer,
  ): Promise<DecodedAudioBuffer>;
}
