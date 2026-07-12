import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { getLastNotebookId } from "../../shared/lastNotebook";

// Khung nội dung rỗng cho từng khu vực. Màn thật thuộc feature khác.
function Placeholder({
  title,
  hint,
}: {
  title: string;
  hint: string;
}): JSX.Element {
  return (
    <section
      className="placeholder"
      data-testid={`placeholder-${title.toLowerCase()}`}
    >
      <h2>{title}</h2>
      <p>{hint}</p>
    </section>
  );
}

export const NotebooksPlaceholder = (): JSX.Element => (
  <Placeholder
    title="Notebooks"
    hint="Danh sách notebook sẽ xuất hiện ở đây (feature sau)."
  />
);

// Workspace cần 1 notebook. 025: nhớ notebook mở gần nhất → mở lại; chưa có / đã xoá → nhắc chọn.
type WsTarget = "loading" | "pick" | string;

export function WorkspacePlaceholder(): JSX.Element {
  const [target, setTarget] = useState<WsTarget>("loading");

  useEffect(() => {
    const id = getLastNotebookId();
    if (!id) {
      setTarget("pick");
      return;
    }
    let cancelled = false;
    window.api
      .notebookList()
      .then((list) => {
        if (cancelled) return;
        setTarget(list.some((n) => n.id === id) ? id : "pick");
      })
      .catch(() => {
        if (!cancelled) setTarget("pick");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (target === "loading") {
    return (
      <section className="placeholder" data-testid="placeholder-workspace" />
    );
  }
  if (target !== "pick") {
    return <Navigate to={`/workspace/${target}`} replace />;
  }
  return (
    <section className="placeholder" data-testid="placeholder-workspace">
      <h2>Workspace</h2>
      <p>Chọn một notebook để mở không gian 3 cột Nguồn / Chat / Studio.</p>
      <Link className="btn-primary-sm" to="/notebooks" data-testid="ws-pick">
        Chọn notebook
      </Link>
    </section>
  );
}

export const SettingsPlaceholder = (): JSX.Element => (
  <Placeholder
    title="Settings"
    hint="Mô hình AI, provider, lưu trữ cục bộ (feature sau)."
  />
);
