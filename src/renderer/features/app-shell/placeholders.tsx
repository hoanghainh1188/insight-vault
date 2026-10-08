import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { getLastNotebookId } from "../../shared/lastNotebook";
import { useT } from "../../shared/i18n/i18n-context";

// 123: bỏ Placeholder/NotebooksPlaceholder/SettingsPlaceholder (không còn route nào dùng — màn thật đã thay).

// Workspace cần 1 notebook. 025: nhớ notebook mở gần nhất → mở lại; chưa có / đã xoá → nhắc chọn.
type WsTarget = "loading" | "pick" | string;

export function WorkspacePlaceholder(): JSX.Element {
  const t = useT();
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
      <h2>{t.t("app.workspace.title")}</h2>
      <p>{t.t("app.workspace.hint")}</p>
      <Link className="btn-primary-sm" to="/notebooks" data-testid="ws-pick">
        {t.t("app.workspace.pick")}
      </Link>
    </section>
  );
}
