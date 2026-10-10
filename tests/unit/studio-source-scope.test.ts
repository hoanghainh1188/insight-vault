import { describe, it, expect } from "vitest";
import {
  resolveSourceScope,
  STUDIO_MAX_SOURCE_IDS,
} from "../../src/main/services/studio/source-scope";
import type { Source, SourceStatus } from "../../src/shared/ipc/types";

// 178 (PR 4, FR-030..FR-033, research R6): phạm vi nguồn của một lượt Studio — kiểm ở MAIN (renderer không tin).

function src(id: string, status: SourceStatus = "ready"): Source {
  return {
    id,
    notebookId: "nb",
    kind: "txt",
    title: `T-${id}`,
    status,
    errorCode: null,
    pageCount: null,
    createdAt: 0,
    updatedAt: 0,
    extractionVersion: 1,
  };
}

const SOURCES = [src("a"), src("b"), src("c"), src("p", "processing")];

describe("resolveSourceScope", () => {
  it("trần là 50", () => {
    expect(STUDIO_MAX_SOURCE_IDS).toBe(50);
  });

  it("thiếu cả hai / mảng rỗng ⇒ ids null (mọi nguồn ready)", () => {
    expect(resolveSourceScope({}, SOURCES)).toEqual({ ok: true, ids: null });
    expect(resolveSourceScope({ sourceIds: [] }, SOURCES)).toEqual({
      ok: true,
      ids: null,
    });
    expect(resolveSourceScope({ sourceId: "" }, SOURCES)).toEqual({
      ok: true,
      ids: null,
    });
  });

  it("sourceId đơn hợp lệ ⇒ [id]", () => {
    expect(resolveSourceScope({ sourceId: "b" }, SOURCES)).toEqual({
      ok: true,
      ids: ["b"],
    });
  });

  it("có cả hai ⇒ sourceIds thắng", () => {
    expect(
      resolveSourceScope({ sourceId: "a", sourceIds: ["c", "b"] }, SOURCES),
    ).toEqual({ ok: true, ids: ["c", "b"] });
  });

  it.each([
    ["không phải mảng", "a"],
    ["object", { 0: "a" }],
    ["phần tử số", ["a", 1]],
    ["phần tử null", [null]],
    ["chuỗi rỗng", ["a", ""]],
  ])("%s ⇒ studioSourcesInvalid", (_label, sourceIds) => {
    expect(resolveSourceScope({ sourceIds }, SOURCES)).toEqual({
      ok: false,
      code: "studioSourcesInvalid",
    });
  });

  it("sourceId không phải chuỗi ⇒ studioSourcesInvalid", () => {
    expect(resolveSourceScope({ sourceId: 7 }, SOURCES)).toEqual({
      ok: false,
      code: "studioSourcesInvalid",
    });
  });

  it("trùng ⇒ khử trùng, giữ thứ tự xuất hiện đầu", () => {
    expect(
      resolveSourceScope({ sourceIds: ["b", "a", "b", "a"] }, SOURCES),
    ).toEqual({ ok: true, ids: ["b", "a"] });
  });

  it("50 id khác nhau hợp lệ; 51 ⇒ studioSourcesInvalid", () => {
    const many = Array.from({ length: 51 }, (_, i) => src(`s${i}`));
    const ids50 = many.slice(0, 50).map((s) => s.id);
    expect(resolveSourceScope({ sourceIds: ids50 }, many)).toEqual({
      ok: true,
      ids: ids50,
    });
    expect(
      resolveSourceScope({ sourceIds: many.map((s) => s.id) }, many),
    ).toEqual({ ok: false, code: "studioSourcesInvalid" });
  });

  it("trùng không tính vào trần (60 phần tử, 2 id khác nhau ⇒ hợp lệ)", () => {
    const ids = Array.from({ length: 60 }, (_, i) => (i % 2 ? "a" : "b"));
    expect(resolveSourceScope({ sourceIds: ids }, SOURCES)).toEqual({
      ok: true,
      ids: ["b", "a"],
    });
  });

  it("id không thuộc notebook ⇒ studioSourcesInvalid (cả lượt)", () => {
    expect(resolveSourceScope({ sourceIds: ["a", "zz"] }, SOURCES)).toEqual({
      ok: false,
      code: "studioSourcesInvalid",
    });
    expect(resolveSourceScope({ sourceId: "zz" }, SOURCES)).toEqual({
      ok: false,
      code: "studioSourcesInvalid",
    });
  });

  it("thuộc notebook nhưng không ready ⇒ studioSourceNotReady", () => {
    expect(resolveSourceScope({ sourceIds: ["a", "p"] }, SOURCES)).toEqual({
      ok: false,
      code: "studioSourceNotReady",
    });
  });

  it("không mutate input", () => {
    const sourceIds = Object.freeze(["b", "b", "a"]);
    const input = Object.freeze({ sourceIds });
    resolveSourceScope(input, SOURCES);
    expect(sourceIds).toEqual(["b", "b", "a"]);
  });
});

describe("resolveSourceScope — mảng thô quá lớn (security M2)", () => {
  it("mảng thô > 200 phần tử (kể cả toàn trùng) ⇒ studioSourcesInvalid ngay, không duyệt hết", () => {
    const huge = new Array<string>(1_000_000).fill("a");
    const t0 = performance.now();
    expect(resolveSourceScope({ sourceIds: huge }, SOURCES)).toEqual({
      ok: false,
      code: "studioSourcesInvalid",
    });
    expect(performance.now() - t0).toBeLessThan(20);
  });

  it("200 phần tử trùng vẫn hợp lệ", () => {
    const ids = new Array<string>(200).fill("a");
    expect(resolveSourceScope({ sourceIds: ids }, SOURCES)).toEqual({
      ok: true,
      ids: ["a"],
    });
  });
});
