import type { Citation, StoredChatMessage } from "@shared/ipc/types";
import type { Db } from "../../db/database";

// Repo lịch sử hội thoại (027-chat-history). Lưu bền theo notebook (SQLite ở main). Nhận Db + deps (now/uuid)
// tiêm → unit-test với :memory:. Cặp user+assistant ghi trong 1 transaction. KHÔNG log nội dung.

interface ChatRow {
  role: "user" | "assistant";
  content: string;
  citations_json: string;
  not_found: number;
  created_at: number;
}

interface RepoDeps {
  now?: () => number;
  uuid?: () => string;
}

export interface AssistantTurn {
  content: string;
  citations: Citation[];
  notFound: boolean;
}

export interface ChatRepo {
  /** Lưu 1 lượt: tin người dùng + tin trợ lý (1 transaction, cùng thứ tự thời gian). */
  saveTurn(
    notebookId: string,
    userContent: string,
    assistant: AssistantTurn,
  ): void;
  /** Lịch sử của notebook theo thứ tự thời gian. */
  listByNotebook(notebookId: string): StoredChatMessage[];
  /** Xoá toàn bộ lịch sử của notebook. */
  clear(notebookId: string): void;
}

function parseCitations(json: string): Citation[] {
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? (v as Citation[]) : [];
  } catch {
    return [];
  }
}

function toMessage(r: ChatRow): StoredChatMessage {
  return {
    role: r.role,
    content: r.content,
    citations: parseCitations(r.citations_json),
    notFound: r.not_found === 1,
    createdAt: r.created_at,
  };
}

export function createChatRepo(db: Db, deps: RepoDeps = {}): ChatRepo {
  const now = deps.now ?? (() => Date.now());
  const uuid = deps.uuid ?? (() => crypto.randomUUID());

  const insert = db.prepare(
    `INSERT INTO chat_message (id, notebook_id, role, content, citations_json, not_found, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  return {
    saveTurn(notebookId, userContent, assistant) {
      // 2 mốc thời gian tăng dần để giữ thứ tự user → assistant kể cả khi cùng ms.
      const tUser = now();
      const tAssistant = tUser + 1;
      db.exec("BEGIN");
      try {
        insert.run(uuid(), notebookId, "user", userContent, "[]", 0, tUser);
        insert.run(
          uuid(),
          notebookId,
          "assistant",
          assistant.content,
          JSON.stringify(assistant.citations),
          assistant.notFound ? 1 : 0,
          tAssistant,
        );
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },

    listByNotebook(notebookId) {
      const rows = db
        .prepare(
          "SELECT * FROM chat_message WHERE notebook_id = ? ORDER BY created_at ASC",
        )
        .all(notebookId) as unknown as ChatRow[];
      return rows.map(toMessage);
    },

    clear(notebookId) {
      db.prepare("DELETE FROM chat_message WHERE notebook_id = ?").run(
        notebookId,
      );
    },
  };
}
