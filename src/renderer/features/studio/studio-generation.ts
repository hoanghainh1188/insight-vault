import type { StudioKind } from "@shared/ipc/types";
import type { ParsedIpcError } from "@shared/online-error-tag";
import type { ActiveGenerationIds } from "./studio-progress";

// 149 (research R5/R6): quyết định thuần về vòng đời một lượt tạo ở renderer.

/** Kết cục của `useStudio.generate`: xong · lỗi · đã huỷ · không còn hiện hành (không ghi state, không thông báo). */
export type StudioGenerateOutcome = "done" | "failed" | "cancelled" | "stale";

/** Lượt `generationId` còn là lượt đang chạy của loại `kind` — chỉ lượt hiện hành được ghi kết quả / trạng thái (sửa race A→B→A). */
export function isCurrentGeneration(
  activeIds: ActiveGenerationIds,
  kind: StudioKind,
  generationId: string,
): boolean {
  return activeIds[kind] === generationId;
}

/** Lỗi IPC của `studio:generate` ⇒ kết cục: mã `studioCancelled` là huỷ (KHÔNG hiện như lỗi), còn lại là lỗi. */
export function outcomeOf(err: ParsedIpcError): "cancelled" | "failed" {
  return err.code === "studioCancelled" ? "cancelled" : "failed";
}

/** Focus sau khi huỷ (nút Huỷ biến mất): "Tạo lại" của kết quả cũ nếu có, ngược lại nút loại. */
export function cancelFocusTarget(hasResult: boolean): "regenerate" | "kind" {
  return hasResult ? "regenerate" : "kind";
}
