import { describe, it, expect } from "vitest";
import type { StudioResult } from "../../src/shared/ipc/types";
import {
  afterDelete,
  currentVersion,
  groupVersions,
  withInserted,
} from "../../src/renderer/features/studio/studio-versions";

// 178 (research R3): hàm THUẦN quản lý phiên bản ở renderer — gom theo loại (mới nhất trước), phiên bản đang xem, chèn
// bản mới (cắt theo trần), xoá. Không mutate đầu vào.

const v = (
  id: string,
  kind: StudioResult["kind"],
  createdAt: number,
): StudioResult => ({
  id,
  notebookId: "nb1",
  kind,
  content: id,
  citations: [],
  createdAt,
});

describe("studio-versions (178)", () => {
  it("groupVersions gom theo loại, mới nhất trước", () => {
    const g = groupVersions([
      v("s1", "summary", 1),
      v("f1", "faq", 5),
      v("s3", "summary", 3),
      v("s2", "summary", 2),
    ]);
    expect(g.summary?.map((r) => r.id)).toEqual(["s3", "s2", "s1"]);
    expect(g.faq?.map((r) => r.id)).toEqual(["f1"]);
    expect(g.outline).toBeUndefined();
  });

  it("groupVersions giữ thứ tự đầu vào khi createdAt trùng (main đã sắp)", () => {
    const g = groupVersions([v("b", "summary", 1), v("a", "summary", 1)]);
    expect(g.summary?.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("currentVersion: theo selected; thiếu / id không còn ⇒ mới nhất; không có bản ⇒ undefined", () => {
    const g = groupVersions([v("s1", "summary", 1), v("s2", "summary", 2)]);
    expect(currentVersion(g, {}, "summary")?.id).toBe("s2");
    expect(currentVersion(g, { summary: "s1" }, "summary")?.id).toBe("s1");
    expect(currentVersion(g, { summary: "gone" }, "summary")?.id).toBe("s2");
    expect(currentVersion(g, {}, "faq")).toBeUndefined();
  });

  it("withInserted đặt bản mới lên đầu, cắt theo trần, không mutate", () => {
    const list = Array.from({ length: 10 }, (_, i) =>
      v(`s${10 - i}`, "summary", 10 - i),
    );
    const before = { summary: list };
    const after = withInserted(before, v("s11", "summary", 11));
    expect(after.summary?.[0].id).toBe("s11");
    expect(after.summary).toHaveLength(10);
    expect(after.summary?.map((r) => r.id)).not.toContain("s1");
    expect(before.summary).toHaveLength(10);
    expect(before.summary[0].id).toBe("s10");
    const fresh = withInserted({}, v("f1", "faq", 1));
    expect(fresh.faq?.map((r) => r.id)).toEqual(["f1"]);
  });

  it("afterDelete: xoá bản đang xem ⇒ chọn bản mới nhất còn lại", () => {
    const g = groupVersions([
      v("s1", "summary", 1),
      v("s2", "summary", 2),
      v("s3", "summary", 3),
    ]);
    const r = afterDelete(g, { summary: "s3" }, "summary", "s3");
    expect(r.versions.summary?.map((x) => x.id)).toEqual(["s2", "s1"]);
    expect(r.nextId).toBe("s2");
    expect(r.selected.summary).toBeUndefined();
    expect(g.summary).toHaveLength(3);
  });

  it("afterDelete: xoá bản KHÔNG đang xem ⇒ giữ lựa chọn", () => {
    const g = groupVersions([v("s1", "summary", 1), v("s2", "summary", 2)]);
    const r = afterDelete(g, { summary: "s1" }, "summary", "s2");
    expect(r.nextId).toBe("s1");
    expect(r.selected.summary).toBe("s1");
  });

  it("afterDelete: xoá bản cuối cùng ⇒ loại không còn bản, nextId undefined", () => {
    const g = groupVersions([v("s1", "summary", 1), v("f1", "faq", 1)]);
    const r = afterDelete(g, {}, "summary", "s1");
    expect(r.versions.summary).toBeUndefined();
    expect(r.versions.faq).toHaveLength(1);
    expect(r.nextId).toBeUndefined();
  });
});
