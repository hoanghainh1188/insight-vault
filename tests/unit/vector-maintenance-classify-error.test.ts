import { describe, expect, it } from "vitest";
import { classifyOptimizeError } from "../../src/main/services/vector-maintenance/classify-error";

// 116 (plan design note 4): xung đột commit đồng thời ⇒ "hoãn"; còn lại ⇒ lỗi kèm loại (không lấy message).

class LanceCommitError extends Error {}

describe("classifyOptimizeError", () => {
  it("xung đột commit ⇒ conflict", () => {
    expect(
      classifyOptimizeError(
        new Error("Retryable commit conflict for version 12"),
      ),
    ).toEqual({ kind: "conflict" });
    const named = new Error("x");
    named.name = "CommitConflictError";
    expect(classifyOptimizeError(named)).toEqual({ kind: "conflict" });
  });

  it("lỗi khác ⇒ error + tên lớp", () => {
    expect(classifyOptimizeError(new TypeError("bad"))).toEqual({
      kind: "error",
      errorType: "TypeError",
    });
    expect(classifyOptimizeError(new LanceCommitError("io"))).toEqual({
      kind: "error",
      errorType: "LanceCommitError",
    });
  });

  it("giá trị không phải Error ⇒ errorType = typeof", () => {
    expect(classifyOptimizeError("boom")).toEqual({
      kind: "error",
      errorType: "string",
    });
    expect(classifyOptimizeError(undefined)).toEqual({
      kind: "error",
      errorType: "undefined",
    });
  });
});
