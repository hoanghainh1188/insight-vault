import type {
  CreateNotebookInput,
  Notebook,
  RenameNotebookInput,
  SetColorInput,
} from "@shared/ipc/types";
import type { Db } from "../../db/database";
import { validateName, validateColor, validateId } from "./validation";

// Repo CRUD notebook (SQLite ở main). Nhận Db + deps (now/uuid) tiêm vào → unit-test với :memory:.

interface RepoDeps {
  now?: () => number;
  uuid?: () => string;
}

interface Row {
  id: string;
  name: string;
  color: string;
  created_at: number;
  updated_at: number;
}

function toNotebook(r: Row): Notebook {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    sourceCount: 0, // chưa có source tới 004 (A4)
  };
}

export interface NotebookRepo {
  list(): Notebook[];
  create(input: CreateNotebookInput): Notebook;
  rename(input: RenameNotebookInput): Notebook;
  setColor(input: SetColorInput): Notebook;
  delete(id: string): { deleted: true };
}

export function createNotebookRepo(db: Db, deps: RepoDeps = {}): NotebookRepo {
  const now = deps.now ?? (() => Date.now());
  const uuid = deps.uuid ?? (() => crypto.randomUUID());

  const getById = (id: string): Notebook => {
    const row = db
      .prepare("SELECT * FROM notebook WHERE id = ?")
      .get(id) as unknown as Row | undefined;
    if (!row) throw new Error("Notebook không tồn tại.");
    return toNotebook(row);
  };

  return {
    list() {
      const rows = db
        .prepare("SELECT * FROM notebook ORDER BY updated_at DESC")
        .all() as unknown as Row[];
      return rows.map(toNotebook);
    },

    create(input) {
      const name = validateName(input.name);
      const color = validateColor(input.color);
      const id = uuid();
      const ts = now();
      db.prepare(
        "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      ).run(id, name, color, ts, ts);
      return getById(id);
    },

    rename(input) {
      const id = validateId(input.id);
      const name = validateName(input.name);
      const res = db
        .prepare("UPDATE notebook SET name = ?, updated_at = ? WHERE id = ?")
        .run(name, now(), id);
      if (res.changes === 0) throw new Error("Notebook không tồn tại.");
      return getById(id);
    },

    setColor(input) {
      const id = validateId(input.id);
      const color = validateColor(input.color);
      const res = db
        .prepare("UPDATE notebook SET color = ?, updated_at = ? WHERE id = ?")
        .run(color, now(), id);
      if (res.changes === 0) throw new Error("Notebook không tồn tại.");
      return getById(id);
    },

    delete(rawId) {
      const id = validateId(rawId);
      db.prepare("DELETE FROM notebook WHERE id = ?").run(id);
      return { deleted: true };
    },
  };
}
