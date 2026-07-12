import { useEffect, useMemo, useRef, useState } from "react";
import { buildSegments } from "./highlight";
import type { SourceViewerState } from "./useSourceViewer";

// Trình xem nguồn (prototype S4) — OVERLAY panel phủ trên Workspace (A3). Render text + highlight đoạn
// trích dẫn (buildSegments — thuần), auto-scroll tới đoạn. Render bằng React text node (không innerHTML).

export function SourceViewer({
  viewer,
}: {
  viewer: SourceViewerState;
}): JSX.Element | null {
  const { isOpen, content, loading, missing, target, close } = viewer;
  const hlRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Map<number, HTMLElement>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null); // 049
  const [currentPage, setCurrentPage] = useState(1);
  const [audioError, setAudioError] = useState(false); // 049: file gốc mất/không phát được

  const citation = target?.citation ?? null;
  const segments = useMemo(() => {
    if (!content) return [];
    return buildSegments(
      content.text,
      citation
        ? {
            charStart: citation.locator.charStart,
            charEnd: citation.locator.charEnd,
          }
        : null,
      content.pageBreaks,
    );
  }, [content, citation]);

  const firstHlIndex = segments.findIndex((s) => s.kind === "highlight");
  const isPdf =
    (content?.kind === "pdf" && content.pageBreaks.length > 0) || false;
  const isAudio = content?.kind === "audio"; // 049
  const pageCount = content?.pageCount ?? 0;
  // Seek theo trích dẫn audio: tStart (giây) từ locator (045 lưu sẵn). undefined nếu mở nguồn trực tiếp.
  const tStart = citation?.locator.tStart;

  // Auto-scroll: tới đoạn highlight (nếu có), ngược lại lên đầu. Đặt trang hiện tại theo trích dẫn.
  useEffect(() => {
    pageRefs.current.clear();
    setCurrentPage(citation?.locator.page ?? 1);
    if (hlRef.current) hlRef.current.scrollIntoView({ block: "center" });
    else if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [segments, citation]);

  // 049: đổi nguồn → reset cờ lỗi audio (thử phát lại nguồn mới).
  useEffect(() => {
    setAudioError(false);
  }, [target?.sourceId]);

  // 049: seek player tới tStart của trích dẫn + tự phát. Chờ loadedmetadata nếu chưa sẵn (đổi src/nguồn).
  useEffect(() => {
    const a = audioRef.current;
    if (!a || tStart == null) return;
    const seek = (): void => {
      a.currentTime = tStart;
      void a.play().catch(() => {}); // autoplay có thể bị chặn — bỏ qua, người dùng tự bấm.
    };
    if (a.readyState >= 1)
      seek(); // HAVE_METADATA
    else {
      a.addEventListener("loadedmetadata", seek, { once: true });
      return () => a.removeEventListener("loadedmetadata", seek);
    }
    return undefined;
  }, [tStart, target?.sourceId]);

  const goToPage = (p: number): void => {
    if (p < 1 || p > pageCount) return;
    setCurrentPage(p);
    pageRefs.current.get(p)?.scrollIntoView({ block: "start" });
  };

  // Đóng bằng Escape (không có backdrop chặn — cột Chat/Nguồn vẫn bấm được để đổi trích dẫn — A3/A5).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <aside
      className="viewer"
      role="dialog"
      aria-label="Trình xem nguồn"
      data-testid="source-viewer"
    >
      <header className="vhead">
        <button
          type="button"
          className="backlink"
          onClick={close}
          data-testid="viewer-close"
        >
          ← Quay lại chat
        </button>
        <div className="vtitle">
          <span className="vname" data-testid="viewer-title">
            {content?.title ?? "Nguồn"}
          </span>
          {citation && (
            <span className="vcite">Nguồn của trích dẫn [{citation.n}]</span>
          )}
        </div>
        {isPdf && (
          <div className="vpager" data-testid="viewer-pager">
            <button
              type="button"
              className="vpager-btn"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Trang trước"
              data-testid="viewer-prev"
            >
              ‹
            </button>
            <span data-testid="viewer-pagenum">
              Trang {currentPage}/{pageCount}
            </span>
            <button
              type="button"
              className="vpager-btn"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= pageCount}
              aria-label="Trang sau"
              data-testid="viewer-next"
            >
              ›
            </button>
          </div>
        )}
      </header>

      <div className="vscroll" ref={bodyRef} data-testid="viewer-body">
        {loading && <p className="viewer-msg">Đang tải nguồn…</p>}
        {missing && (
          <p className="viewer-msg" data-testid="viewer-missing">
            Nguồn không còn tồn tại.
          </p>
        )}
        {!loading && !missing && content && isAudio && target && (
          <div className="vaudio" data-testid="viewer-audio-player">
            <audio
              ref={audioRef}
              controls
              preload="metadata"
              className="vaudio-el"
              src={`iv-media://source/${encodeURIComponent(target.sourceId)}`}
              onError={() => setAudioError(true)}
            />
            {audioError && (
              <p className="vaudio-err" data-testid="viewer-audio-error">
                Không phát được file âm thanh gốc (có thể đã bị xoá hoặc di
                chuyển). Bản bóc băng bên dưới vẫn xem được.
              </p>
            )}
          </div>
        )}
        {!loading && !missing && content && (
          <div className="vtext">
            {segments.length === 0 && (
              <span className="viewer-msg">(Nguồn trống)</span>
            )}
            {segments.map((s, i) => (
              <span key={i}>
                {s.pageMark !== undefined && (
                  <span
                    className="pagemark"
                    ref={(el) => {
                      if (el) pageRefs.current.set(s.pageMark!, el);
                    }}
                  >
                    — Trang {s.pageMark} —
                  </span>
                )}
                {s.kind === "highlight" ? (
                  <mark
                    className="hl"
                    ref={i === firstHlIndex ? hlRef : undefined}
                  >
                    {i === firstHlIndex && citation && (
                      <span className="hltag" data-testid="viewer-hltag">
                        [{citation.n}]
                      </span>
                    )}
                    {s.text}
                  </mark>
                ) : (
                  <span>{s.text}</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
