import { PDF_EXTRACTION_VERSION } from "@shared/ipc/types";

// 147 (research R4, clarify #22): câu gợi ý "Xử lý lại" theo phiên bản trích xuất của nguồn PDF — PDF chưa có bố cục (v1) giữ câu
// "giữ bố cục" của 112; PDF đã có bố cục (v2) ⇒ câu cải thiện của 147; bản hiện hành ⇒ không gợi ý. Hàm thuần.

export type ReprocessHintKey = "reprocessHint" | "reprocessHintV2";

export function reprocessHintKey(
  extractionVersion: number,
): ReprocessHintKey | null {
  if (extractionVersion >= PDF_EXTRACTION_VERSION) return null;
  return extractionVersion <= 1 ? "reprocessHint" : "reprocessHintV2";
}
