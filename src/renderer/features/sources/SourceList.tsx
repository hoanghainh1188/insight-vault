import { useState } from "react";
import type { ContentSearchHit } from "@shared/ipc/types";
import { useSources } from "./useSources";
import { aggregateLabel } from "./source-status";
import { SourceItem } from "./SourceItem";
import { AddSourceModal } from "./AddSourceModal";
import { ContentSearchBox } from "../search/ContentSearchBox";
import { useT } from "../../shared/i18n/i18n-context";

// Cột "Nguồn" của Workspace (prototype S2): header tổng hợp + nút thêm + tìm toàn văn (073) + danh sách nguồn + modal.
export function SourceList({
  notebookId,
  onOpenSource,
  onOpenHit,
}: {
  notebookId: string;
  onOpenSource?: (sourceId: string) => void; // 019: mở trình xem nguồn
  onOpenHit?: (hit: ContentSearchHit) => void; // 073: mở kết quả tìm + highlight
}): JSX.Element {
  const t = useT();
  const { sources, loading, progress, add, remove, retry } =
    useSources(notebookId);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <section className="src-col" aria-label={t.t("sources.list.label")}>
      <header className="src-head">
        <div>
          <h2>{t.t("sources.list.label")}</h2>
          <span className="src-agg" data-testid="source-aggregate">
            {aggregateLabel(sources, t)}
          </span>
        </div>
        <button
          type="button"
          className="btn-outline-sm"
          onClick={() => setShowAdd(true)}
          data-testid="add-source-btn"
        >
          {t.t("sources.list.add")}
        </button>
      </header>

      {onOpenHit && (
        <ContentSearchBox notebookId={notebookId} onOpenHit={onOpenHit} />
      )}

      {loading ? (
        <ul
          className="srclist"
          data-testid="source-skeleton"
          aria-hidden="true"
        >
          {[0, 1, 2].map((i) => (
            <li key={i} className="src src-skel">
              <span className="src-icon skel-box" />
              <div className="src-main">
                <span className="skel-line" />
                <span className="skel-line short" />
              </div>
            </li>
          ))}
        </ul>
      ) : sources.length === 0 ? (
        <p className="src-empty" data-testid="source-empty">
          {t.t("sources.list.empty")}
        </p>
      ) : (
        <ul className="srclist">
          {sources.map((s) => (
            <SourceItem
              key={s.id}
              source={s}
              progress={progress[s.id]}
              onRetry={retry}
              onDelete={remove}
              onOpen={onOpenSource}
            />
          ))}
        </ul>
      )}

      {showAdd && (
        <AddSourceModal
          notebookId={notebookId}
          onAdd={add}
          onClose={() => setShowAdd(false)}
        />
      )}
    </section>
  );
}
