import { useEffect, useRef, useState } from "react";
import type { ContentSearchHit } from "@shared/ipc/types";

// Tìm toàn văn nội dung nguồn trong notebook (073). Debounce 250ms; guard reqRef chống kết quả cũ đè mới.
// Bấm 1 kết quả → onOpenHit (mở Source Viewer + highlight đúng locator — kiểm chứng được).

export function ContentSearchBox({
  notebookId,
  onOpenHit,
}: {
  notebookId: string;
  onOpenHit: (hit: ContentSearchHit) => void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ContentSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const reqRef = useRef(0);

  // Đổi notebook → xoá ô tìm + kết quả.
  useEffect(() => {
    setQuery("");
    setHits([]);
  }, [notebookId]);

  useEffect(() => {
    const q = query.trim();
    if (q === "") {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const myReq = ++reqRef.current;
    const timer = setTimeout(() => {
      window.api
        .sourceSearch(notebookId, q)
        .then((res) => {
          if (reqRef.current === myReq) setHits(res);
        })
        .catch(() => {
          if (reqRef.current === myReq) setHits([]);
        })
        .finally(() => {
          if (reqRef.current === myReq) setSearching(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, notebookId]);

  const q = query.trim();
  return (
    <div className="csearch" data-testid="content-search">
      <input
        className="csearch-input"
        type="search"
        placeholder="Tìm trong nội dung nguồn…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Tìm trong nội dung nguồn"
        data-testid="content-search-input"
      />
      {q !== "" && (
        <div className="csearch-results" data-testid="content-search-results">
          {searching && hits.length === 0 ? (
            <p className="csearch-note">Đang tìm…</p>
          ) : hits.length === 0 ? (
            <p className="csearch-note" data-testid="content-search-empty">
              Không có kết quả.
            </p>
          ) : (
            <ul className="csearch-list">
              {hits.map((h) => (
                <li key={h.chunkId}>
                  <button
                    type="button"
                    className="csearch-hit"
                    onClick={() => onOpenHit(h)}
                    data-testid="content-search-hit"
                  >
                    <span className="csearch-hit-src">
                      {h.sourceTitle}
                      {h.locator.page != null
                        ? ` · trang ${h.locator.page}`
                        : ""}
                    </span>
                    <span className="csearch-hit-snip">{h.snippet}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
