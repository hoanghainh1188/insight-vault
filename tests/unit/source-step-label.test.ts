import { describe, it, expect } from "vitest";
import { stepLabel } from "../../src/renderer/features/sources/source-status";
import type { IngestStep } from "../../src/shared/ipc/types";

describe("stepLabel (037)", () => {
  it("phủ 6 bước, trả nhãn tiếng Việt không rỗng", () => {
    const steps: IngestStep[] = [
      "parse",
      "clean",
      "chunk",
      "embed",
      "store",
      "done",
    ];
    for (const s of steps) {
      expect(stepLabel(s)).toBeTruthy();
      expect(typeof stepLabel(s)).toBe("string");
    }
    expect(stepLabel("parse")).toMatch(/Phân tích/);
    expect(stepLabel("embed")).toMatch(/Nhúng/);
  });
});
