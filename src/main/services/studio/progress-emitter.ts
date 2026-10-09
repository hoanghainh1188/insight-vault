import type {
  StudioGenerateInput,
  StudioProgressEvent,
} from "@shared/ipc/types";
import { isValidGenerationId } from "@shared/studio-progress";
import type { OnStudioProgress } from "./map-reduce";

// 146 (analyze M1): nối dây tiến độ Studio → kênh push `studio:progress`. Hàm THUẦN (send tiêm vào) — id hợp lệ ⇒ onProgress
// gửi payload tối thiểu (chỉ định danh + pha + số đếm, KHÔNG nội dung); id thiếu/sai ⇒ không phát. Không log payload.

export function createStudioProgressEmitter(
  input: StudioGenerateInput,
  send: (ev: StudioProgressEvent) => void,
): OnStudioProgress | undefined {
  const { generationId, notebookId, kind } = input;
  if (!isValidGenerationId(generationId)) return undefined;
  return (step) => {
    const ev: StudioProgressEvent = {
      generationId,
      notebookId,
      kind,
      phase: step.phase,
    };
    if (step.index !== undefined) ev.index = step.index;
    if (step.total !== undefined) ev.total = step.total;
    try {
      send(ev);
    } catch {
      // cửa sổ đã đóng — tiến độ chỉ là phụ
    }
  };
}
