import { describe, it, expect } from "vitest";
import { reprocessHintKey } from "../../src/renderer/features/sources/reprocess-hint";

// 147 (research R4, clarify #22): câu gợi ý "Xử lý lại" theo phiên bản trích xuất của nguồn PDF.

describe("reprocessHintKey", () => {
  it("v1 (chưa có bố cục) ⇒ câu cũ 'giữ bố cục'; v2 ⇒ câu mới; bản hiện hành trở lên ⇒ không gợi ý", () => {
    expect(reprocessHintKey(1)).toBe("reprocessHint");
    expect(reprocessHintKey(2)).toBe("reprocessHintV2");
    expect(reprocessHintKey(3)).toBeNull();
    expect(reprocessHintKey(4)).toBeNull();
  });
});
