import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Notebook } from "@shared/ipc/types";
import { useNotebooks } from "./useNotebooks";
import { NotebookCard } from "./NotebookCard";
import { NotebookModal } from "./NotebookModal";
import { DeleteConfirm } from "./DeleteConfirm";
import { IconSearch, IconPlus } from "../../shared/icons";

type ModalState =
  { kind: "create" } | { kind: "edit"; notebook: Notebook } | null;

// Màn Notebooks (S1): lưới card + ô tìm kiếm client-side (A5) + tạo/sửa/xoá qua modal.
export function NotebooksGrid(): JSX.Element {
  const { notebooks, create, rename, setColor, remove } = useNotebooks();
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [pendingDelete, setPendingDelete] = useState<Notebook | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef<HTMLInputElement>(null);
  const now = Date.now();

  // Phím tắt (043): Cmd+N → mở modal tạo; Cmd+K → focus ô tìm (ý định qua navigation state).
  useEffect(() => {
    const s = (location.state as { shortcut?: string } | null)?.shortcut;
    if (s === "create") setModal({ kind: "create" });
    else if (s === "focus") searchRef.current?.focus();
  }, [location.state]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? notebooks.filter((n) => n.name.toLowerCase().includes(q))
      : notebooks;
  }, [notebooks, query]);

  return (
    <section className="notebooks" data-testid="placeholder-notebooks">
      <div className="notebooks-head">
        <div>
          <h2>Notebook của bạn</h2>
          <p className="notebooks-sub">
            Mỗi notebook là một không gian riêng cho một chủ đề nghiên cứu
          </p>
        </div>
        <div className="nb-search">
          <IconSearch size={16} />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm notebook… (⌘K)"
            aria-label="Tìm notebook"
            data-testid="notebook-search"
          />
        </div>
        <button
          type="button"
          className="btn-primary-sm"
          onClick={() => setModal({ kind: "create" })}
          data-testid="notebook-new"
        >
          <IconPlus size={15} />
          Notebook mới
        </button>
      </div>

      {notebooks.length === 0 ? (
        <div className="nb-empty" data-testid="notebooks-empty">
          <p className="nb-empty-title">Chưa có notebook nào</p>
          <p className="nb-empty-sub">
            Tạo notebook đầu tiên để bắt đầu nạp nguồn và hỏi đáp.
          </p>
          <button
            type="button"
            className="btn-primary-sm"
            onClick={() => setModal({ kind: "create" })}
            data-testid="notebook-create-card"
          >
            <IconPlus size={15} />
            Tạo notebook mới
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="nb-empty" data-testid="notebooks-no-result">
          <p className="nb-empty-title">Không tìm thấy notebook</p>
          <p className="nb-empty-sub">
            Không có notebook nào khớp “{query}”. Thử từ khoá khác.
          </p>
        </div>
      ) : (
        <div className="nb-grid">
          {filtered.map((n) => (
            <NotebookCard
              key={n.id}
              notebook={n}
              now={now}
              onOpen={() => navigate(`/workspace/${n.id}`)}
              onEdit={() => setModal({ kind: "edit", notebook: n })}
              onDelete={() => setPendingDelete(n)}
            />
          ))}
          <button
            type="button"
            className="nb-card-new"
            onClick={() => setModal({ kind: "create" })}
            data-testid="notebook-create-card"
          >
            <IconPlus size={22} />
            Tạo notebook mới
          </button>
        </div>
      )}

      {modal?.kind === "create" && (
        <NotebookModal
          mode="create"
          onSubmit={(name, color) => create({ name, color })}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "edit" && (
        <NotebookModal
          mode="edit"
          initialName={modal.notebook.name}
          initialColor={modal.notebook.color}
          onSubmit={async (name, color) => {
            if (name !== modal.notebook.name)
              await rename({ id: modal.notebook.id, name });
            if (color !== modal.notebook.color)
              await setColor({ id: modal.notebook.id, color });
          }}
          onClose={() => setModal(null)}
        />
      )}
      {pendingDelete && (
        <DeleteConfirm
          name={pendingDelete.name}
          error={deleteError}
          onConfirm={() => {
            remove(pendingDelete.id)
              .then(() => {
                setPendingDelete(null);
                setDeleteError(null);
              })
              .catch((e: unknown) =>
                setDeleteError(
                  e instanceof Error ? e.message : "Xoá thất bại.",
                ),
              );
          }}
          onCancel={() => {
            setPendingDelete(null);
            setDeleteError(null);
          }}
        />
      )}
    </section>
  );
}
