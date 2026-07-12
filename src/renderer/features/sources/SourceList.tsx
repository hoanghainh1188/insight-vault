import { useState } from "react";
import { useSources } from "./useSources";
import { aggregateLabel } from "./source-status";
import { SourceItem } from "./SourceItem";
import { AddSourceModal } from "./AddSourceModal";

// Cột "Nguồn" của Workspace (prototype S2): header tổng hợp + nút thêm + danh sách nguồn + modal.
export function SourceList({
  notebookId,
  onOpenSource,
}: {
  notebookId: string;
  onOpenSource?: (sourceId: string) => void; // 019: mở trình xem nguồn
}): JSX.Element {
  const { sources, loading, progress, add, remove, retry } =
    useSources(notebookId);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <section className="src-col" aria-label="Nguồn">
      <header className="src-head">
        <div>
          <h2>Nguồn</h2>
          <span className="src-agg" data-testid="source-aggregate">
            {aggregateLabel(sources)}
          </span>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowAdd(true)}
          data-testid="add-source-btn"
        >
          Thêm nguồn
        </button>
      </header>

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
          Chưa có nguồn. Bấm “Thêm nguồn” để nạp tài liệu.
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
