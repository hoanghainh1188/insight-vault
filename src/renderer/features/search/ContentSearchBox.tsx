import { useEffect, useRef, useState } from "react";
import type { ContentSearchHit } from "@shared/ipc/types";
import { pageSuffix } from "../rag-qa/citation-format";
import { useT } from "../../shared/i18n/i18n-context";

// Tìm toàn văn nội dung nguồn trong notebook (073). Debounce 250ms; guard reqRef chống kết quả cũ đè mới.
// Bấm 1 kết quả → onOpenHit (mở Source Viewer + highlight đúng locator — kiểm chứng được).

export function ContentSearchBox({
  notebookId,
  onOpenHit,
}: {
  notebookId: string;
  onOpenHit: (hit: ContentSearchHit) => void;
}): JSX.Element {
  const t = useT();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ContentSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const reqRef = useRef(0);

  // Đổi notebook → xoá ô tìm + kết quả.
  useEffect(() => {
    setQuery("");
    setHits([]);
    setFailed(false);
  }, [notebookId]);

  useEffect(() => {
    const q = query.trim();
    if (q === "") {
      setHits([]);
      setSearching(false);
      setFailed(false);
      return;
    }
    setSearching(true);
    setFailed(false);
    const myReq = ++reqRef.current;
    const timer = setTimeout(() => {
      window.api
        .sourceSearch(notebookId, q)
        .then((res) => {
          if (reqRef.current === myReq) setHits(res);
        })
        .catch(() => {
          // Lỗi thật (khác "không khớp") → cờ riêng để hiển thị khác. KHÔNG lộ chi tiết kỹ thuật.
          if (reqRef.current === myReq) {
            setHits([]);
            setFailed(true);
          }
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
        placeholder={t.t("search.content.placeholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t.t("search.content.label")}
        data-testid="content-search-input"
      />
      {q !== "" && (
        <div className="csearch-results" data-testid="content-search-results">
          {searching && hits.length === 0 ? (
            <p className="csearch-note">{t.t("search.content.searching")}</p>
          ) : failed ? (
            <p className="csearch-note" data-testid="content-search-error">
              {t.t("search.content.error")}
            </p>
          ) : hits.length === 0 ? (
            <p className="csearch-note" data-testid="content-search-empty">
              {t.t("search.content.empty")}
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
                      {pageSuffix(h.locator.page, t)}
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
