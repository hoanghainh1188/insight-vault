import { describe, it, expect } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import { runMigrations } from "../../src/main/db/migrations";
import { createNotebookRepo } from "../../src/main/services/notebooks/notebook-repo";
import { PALETTE } from "../../src/main/services/notebooks/palette";

function repo() {
  const db = openDatabase(":memory:");
  runMigrations(db);
  let t = 1000;
  let n = 0;
  // now tăng dần + uuid tất định để test ordering
  return createNotebookRepo(db, { now: () => ++t, uuid: () => `id-${++n}` });
}

const C0 = PALETTE[0];
const C1 = PALETTE[1];

describe("notebook-repo", () => {
  it("create → list (sắp updated_at desc, sourceCount=0)", () => {
    const r = repo();
    r.create({ name: "A", color: C0 });
    r.create({ name: "B", color: C1 });
    const list = r.list();
    expect(list.map((n) => n.name)).toEqual(["B", "A"]); // B mới hơn
    expect(list[0]).toMatchObject({ color: C1, sourceCount: 0 });
    expect(list[0].id).toBeTruthy();
  });

  it("rename cập nhật name + updated_at", () => {
    const r = repo();
    const nb = r.create({ name: "Cũ", color: C0 });
    const renamed = r.rename({ id: nb.id, name: "  Mới  " });
    expect(renamed.name).toBe("Mới");
    expect(renamed.updatedAt).toBeGreaterThan(nb.updatedAt);
  });

  it("setColor cập nhật màu", () => {
    const r = repo();
    const nb = r.create({ name: "X", color: C0 });
    expect(r.setColor({ id: nb.id, color: C1 }).color).toBe(C1);
  });

  it("delete gỡ khỏi list", () => {
    const r = repo();
    const nb = r.create({ name: "X", color: C0 });
    expect(r.delete(nb.id)).toEqual({ deleted: true });
    expect(r.list()).toHaveLength(0);
  });

  it("validate tích hợp: tên rỗng / màu ngoài palette → ném, không ghi", () => {
    const r = repo();
    expect(() => r.create({ name: "  ", color: C0 })).toThrow();
    expect(() => r.create({ name: "OK", color: "#000000" })).toThrow();
    expect(r.list()).toHaveLength(0);
  });

  it("rename/setColor notebook không tồn tại → ném", () => {
    const r = repo();
    expect(() => r.rename({ id: "khong-co", name: "x" })).toThrow(
      /không tồn tại/,
    );
    expect(() => r.setColor({ id: "khong-co", color: C0 })).toThrow(
      /không tồn tại/,
    );
  });

  it("sourceCount đếm THẬT từ bảng source (011-ingestion)", () => {
    const db = openDatabase(":memory:");
    runMigrations(db);
    const r = createNotebookRepo(db);
    const nb = r.create({ name: "A", color: C0 });
    expect(r.list()[0].sourceCount).toBe(0);
    db.prepare(
      "INSERT INTO source (id, notebook_id, kind, title, origin, status, content_hash, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run("s1", nb.id, "txt", "t", "/p", "ready", "h", 1, 1);
    db.prepare(
      "INSERT INTO source (id, notebook_id, kind, title, origin, status, content_hash, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run("s2", nb.id, "url", "u", "http://x", "queued", "h2", 1, 1);
    expect(r.list()[0].sourceCount).toBe(2);
  });
});
