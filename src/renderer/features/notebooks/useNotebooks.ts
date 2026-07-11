import { useCallback, useEffect, useState } from "react";
import type {
  CreateNotebookInput,
  Notebook,
  RenameNotebookInput,
  SetColorInput,
} from "@shared/ipc/types";

function message(e: unknown): string {
  return e instanceof Error ? e.message : "Đã xảy ra lỗi.";
}

// Hook quản lý danh sách notebook + thao tác CRUD qua window.api.notebook*. Mọi lỗi từ main (validate…)
// trả về để UI hiển thị, không nuốt im lặng.
export function useNotebooks() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    window.api
      .notebookList()
      .then((list) => setNotebooks(list))
      .catch(() => setNotebooks([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => reload(), [reload]);

  const create = useCallback(
    async (input: CreateNotebookInput): Promise<void> => {
      try {
        await window.api.notebookCreate(input);
        reload();
      } catch (e) {
        throw new Error(message(e));
      }
    },
    [reload],
  );

  const rename = useCallback(
    async (input: RenameNotebookInput): Promise<void> => {
      try {
        await window.api.notebookRename(input);
        reload();
      } catch (e) {
        throw new Error(message(e));
      }
    },
    [reload],
  );

  const setColor = useCallback(
    async (input: SetColorInput): Promise<void> => {
      try {
        await window.api.notebookSetColor(input);
        reload();
      } catch (e) {
        throw new Error(message(e));
      }
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      try {
        await window.api.notebookDelete(id);
      } catch (e) {
        reload(); // đồng bộ lại trạng thái rồi báo lỗi lên UI (không nuốt im lặng)
        throw new Error(message(e));
      }
      reload();
    },
    [reload],
  );

  return { notebooks, loading, reload, create, rename, setColor, remove };
}
