import { describe, it, expect } from "vitest";
import type { Citation } from "../../src/shared/ipc/types";
import { openDatabase } from "../../src/main/db/database";
import { runMigrations, getUserVersion } from "../../src/main/db/migrations";
import { createChatRepo } from "../../src/main/services/rag/chat-repo";

function setup() {
  const db = openDatabase(":memory:");
  runMigrations(db);
  for (const id of ["nb1", "nb2"]) {
    db.prepare(
      "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
    ).run(id, id, "#4F46E5", 1, 1);
  }
  let t = 1000;
  let n = 0;
  const repo = createChatRepo(db, {
    now: () => (t += 10),
    uuid: () => `id-${++n}`,
  });
  return { db, repo };
}

const cites: Citation[] = [
  {
    n: 1,
    chunkId: "c1",
    sourceId: "s1",
    sourceTitle: "Tài liệu",
    locator: { page: 2, charStart: 10, charEnd: 40 },
  },
];

describe("chat-repo (027)", () => {
  it("migration #4 (chat_message) đã áp — user_version ≥ 4", () => {
    const { db } = setup();
    expect(getUserVersion(db)).toBeGreaterThanOrEqual(4);
  });

  it("saveTurn ghi 2 hàng (user trước assistant); listByNotebook đúng thứ tự + khứ hồi citations/notFound", () => {
    const { repo } = setup();
    repo.saveTurn("nb1", "câu hỏi 1", {
      content: "trả lời 1 [1]",
      citations: cites,
      notFound: false,
    });
    const list = repo.listByNotebook("nb1");
    expect(list.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(list[0].content).toBe("câu hỏi 1");
    expect(list[0].citations).toEqual([]);
    expect(list[1].content).toBe("trả lời 1 [1]");
    expect(list[1].citations).toEqual(cites);
    expect(list[1].citations[0].locator.charStart).toBe(10);
    expect(list[1].notFound).toBe(false);
  });

  it("lưu notFound=true đúng", () => {
    const { repo } = setup();
    repo.saveTurn("nb1", "hỏi", {
      content: "Không tìm thấy trong nguồn.",
      citations: [],
      notFound: true,
    });
    const assistant = repo.listByNotebook("nb1")[1];
    expect(assistant.notFound).toBe(true);
  });

  it("071: khứ hồi modeUsed='open' (badge bền qua reload); user row không có mode", () => {
    const { repo } = setup();
    repo.saveTurn("nb1", "hỏi", {
      content: "trả lời mở rộng",
      citations: [],
      notFound: false,
      modeUsed: "open",
    });
    const list = repo.listByNotebook("nb1");
    expect(list[0].modeUsed).toBeUndefined(); // user row
    expect(list[1].modeUsed).toBe("open"); // assistant row
  });

  it("071: bỏ trống modeUsed → mặc định 'grounded' (không badge)", () => {
    const { repo } = setup();
    repo.saveTurn("nb1", "hỏi", {
      content: "trả lời theo nguồn [1]",
      citations: cites,
      notFound: false,
    });
    expect(repo.listByNotebook("nb1")[1].modeUsed).toBe("grounded");
  });

  it("071: hàng cũ mode_used=NULL (trước migration #8) → modeUsed undefined (coi như grounded)", () => {
    const { db, repo } = setup();
    db.prepare(
      "INSERT INTO chat_message (id, notebook_id, role, content, citations_json, not_found, mode_used, created_at) VALUES (?,?,?,?,?,?,?,?)",
    ).run("old", "nb1", "assistant", "cũ", "[]", 0, null, 5000);
    expect(repo.listByNotebook("nb1")[0].modeUsed).toBeUndefined();
  });

  it("citations_json hỏng → parse an toàn thành [] (không vỡ)", () => {
    const { db, repo } = setup();
    db.prepare(
      "INSERT INTO chat_message (id, notebook_id, role, content, citations_json, not_found, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run("bad", "nb1", "assistant", "x", "{ khong phai json", 0, 5000);
    const msg = repo.listByNotebook("nb1")[0];
    expect(msg.citations).toEqual([]);
  });

  it("clear xoá hết lịch sử notebook đó, giữ notebook khác", () => {
    const { repo } = setup();
    repo.saveTurn("nb1", "a", { content: "b", citations: [], notFound: false });
    repo.saveTurn("nb2", "c", { content: "d", citations: [], notFound: false });
    repo.clear("nb1");
    expect(repo.listByNotebook("nb1")).toHaveLength(0);
    expect(repo.listByNotebook("nb2")).toHaveLength(2);
  });

  it("xoá notebook → FK CASCADE xoá lịch sử; notebook khác không ảnh hưởng", () => {
    const { db, repo } = setup();
    repo.saveTurn("nb1", "a", { content: "b", citations: [], notFound: false });
    repo.saveTurn("nb2", "c", { content: "d", citations: [], notFound: false });
    db.prepare("DELETE FROM notebook WHERE id = ?").run("nb1");
    expect(repo.listByNotebook("nb1")).toHaveLength(0);
    expect(repo.listByNotebook("nb2")).toHaveLength(2);
  });
});
