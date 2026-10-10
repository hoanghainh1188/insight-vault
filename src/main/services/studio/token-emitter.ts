import type { StudioStreamTokenEvent } from "@shared/ipc/types";
import { isValidGenerationId } from "@shared/studio-progress";

// 178 (PR 4, FR-041/FR-042, research R8): nối dây stream lượt viết cuối → kênh push `studio:streamToken`. Hàm THUẦN (sink tiêm
// vào): `sink` là sender ĐÃ GỌI studio:generate — KHÔNG broadcast mọi cửa sổ (khác rag:streamToken). Payload CHỈ
// {generationId, delta}. Id thiếu / sai ⇒ không stream (hành vi không-stream). Sau huỷ / cửa sổ đóng ⇒ không gửi. Không log.

export interface StudioTokenSink {
  send: (ev: StudioStreamTokenEvent) => void;
  isDestroyed: () => boolean;
}

export function createStudioTokenEmitter(
  generationId: unknown,
  signal: AbortSignal | undefined,
  sink: StudioTokenSink,
): ((delta: string) => void) | undefined {
  if (!isValidGenerationId(generationId)) return undefined;
  return (delta) => {
    if (delta === "" || signal?.aborted || sink.isDestroyed()) return;
    try {
      sink.send({ generationId, delta });
    } catch {
      // cửa sổ vừa đóng — stream chỉ là phụ
    }
  };
}
