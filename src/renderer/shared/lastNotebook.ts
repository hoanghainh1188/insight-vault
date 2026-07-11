// Nhớ notebook mở gần nhất (025-workspace-enhance) — cho nút "Workspace" trên rail mở lại đúng notebook.
// Lưu localStorage (trạng thái UI, không cần IPC). THUẦN — unit-test. Mọi thao tác an toàn (không throw).

const KEY = "last-notebook-id";

export function getLastNotebookId(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && v.trim() !== "" ? v : null;
  } catch {
    return null;
  }
}

export function setLastNotebookId(id: string): void {
  try {
    if (id) localStorage.setItem(KEY, id);
  } catch {
    // localStorage không dùng được → bỏ qua (nav vẫn hoạt động, chỉ không nhớ).
  }
}
