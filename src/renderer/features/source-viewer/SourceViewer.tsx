import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRelink } from "../sources/useRelink";
import { useT } from "../../shared/i18n/i18n-context";
import { buildViewerBlocks, type ViewerBlock } from "./highlight";
import { SegmentText, SourceTable } from "./SourceTable";
import { parsePdfTables, type PdfTable } from "@shared/pdf-tables";
import type { SourceViewerState } from "./useSourceViewer";

// Trình xem nguồn (prototype S4) — OVERLAY panel phủ trên Workspace (A3). Render text + highlight đoạn
// trích dẫn (buildSegments — thuần), auto-scroll tới đoạn. Render bằng React text node (không innerHTML).

const mediaSrcFor = (sourceId: string, rev: number): string =>
  `iv-media://source/${encodeURIComponent(sourceId)}${rev > 0 ? `?r=${rev}` : ""}`;

export function SourceViewer({
  viewer,
}: {
  viewer: SourceViewerState;
}): JSX.Element | null {
  const t = useT();
  const { isOpen, content, loading, missing, target, close } = viewer;
  const hlRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Map<number, HTMLElement>>(new Map());
  const audioRef = useRef<HTMLMediaElement | null>(null); // 049 audio + 051 video (cùng HTMLMediaElement)
  const [currentPage, setCurrentPage] = useState(1);
  const [audioError, setAudioError] = useState(false); // 049: file gốc mất/không phát được
  // 101: chọn lại tệp gốc ⇒ tăng rev để <audio>/<video>/<img> nạp lại (src đổi).
  const [mediaRev, setMediaRev] = useState(0);
  const mediaSrc = (sourceId: string): string =>
    mediaSrcFor(sourceId, mediaRev);
  const onRelinked = (): void => {
    setAudioError(false);
    setMediaRev((r) => r + 1);
  };

  const citation = target?.citation ?? null;
  // 112 (FR-017): trích dẫn cũ — nguồn đã được xử lý lại (chunk của trích dẫn không còn) ⇒ KHÔNG tô sáng sai chỗ.
  const stale = citation !== null && content?.citationValid === false;
  // 147 (e): bảng của PDF ⇒ lưới (mặc định) hoặc văn bản (công tắc, nhớ trong phiên). Lỗi phân tích ⇒ văn bản như cũ.
  const tables = useMemo<PdfTable[]>(() => {
    if (!content || content.kind !== "pdf") return [];
    try {
      return parsePdfTables(content.text, content.pageBreaks);
    } catch {
      return [];
    }
  }, [content]);
  const [view, setView] = useState<TableView>(readTableView);
  const chooseView = (v: TableView): void => {
    setView(v);
    writeTableView(v);
  };
  const blocks = useMemo<ViewerBlock[]>(() => {
    if (!content) return [];
    return buildViewerBlocks(
      content.text,
      citation && !stale
        ? {
            charStart: citation.locator.charStart,
            charEnd: citation.locator.charEnd,
          }
        : null,
      content.pageBreaks,
      view === "grid" ? tables : [],
    );
  }, [content, citation, stale, tables, view]);

  const isPdf =
    (content?.kind === "pdf" && content.pageBreaks.length > 0) || false;
  const isAudio = content?.kind === "audio"; // 049
  const isVideo = content?.kind === "video"; // 051
  const isMedia = isAudio || isVideo; // player audio/video dùng chung iv-media:// + effect seek/onError
  const isImage = content?.kind === "image"; // 053
  const pageCount = content?.pageCount ?? 0;
  // Seek theo trích dẫn media: tStart (giây) từ locator (045 lưu sẵn). undefined nếu mở nguồn trực tiếp.
  const tStart = citation?.locator.tStart;
  // Ảnh (053): vùng chữ (bbox 0..1) của trích dẫn → overlay khung. undefined nếu mở trực tiếp.
  const bbox = citation?.locator.bbox;

  // Auto-scroll: tới đoạn highlight (nếu có), ngược lại lên đầu. Đặt trang hiện tại theo trích dẫn.
  useEffect(() => {
    // 112: trích dẫn cũ ⇒ không có vùng tô sáng; cuộn tới trang của trích dẫn (nếu còn trong phạm vi).
    if (stale && citation?.locator.page != null) {
      pageRefs.current
        .get(citation.locator.page)
        ?.scrollIntoView({ block: "start" });
    }
    pageRefs.current.clear();
    setCurrentPage(citation?.locator.page ?? 1);
    if (hlRef.current) hlRef.current.scrollIntoView({ block: "center" });
    else if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [blocks, citation, stale]);

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
      aria-label={t.t("viewer.label")}
      data-testid="source-viewer"
    >
      <header className="vhead">
        <button
          type="button"
          className="backlink"
          onClick={close}
          data-testid="viewer-close"
        >
          {t.t("viewer.back")}
        </button>
        <div className="vtitle">
          <span className="vname" data-testid="viewer-title">
            {content?.title ?? t.t("viewer.titleFallback")}
          </span>
          {citation && (
            <span className="vcite">
              {t.t("viewer.citationOf", { n: citation.n })}
            </span>
          )}
          {stale && (
            <span
              className="vstale"
              role="status"
              data-testid="viewer-stale-note"
            >
              {t.t("viewer.stale")}
            </span>
          )}
        </div>
        {tables.length > 0 && (
          <div
            className="vview"
            role="group"
            aria-label={t.t("viewer.view.label")}
          >
            {(["grid", "text"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className="vview-btn"
                aria-pressed={view === v}
                onClick={() => chooseView(v)}
                data-testid={`viewer-view-${v}`}
              >
                {t.t(`viewer.view.${v}`)}
              </button>
            ))}
          </div>
        )}
        {isPdf && (
          <div className="vpager" data-testid="viewer-pager">
            <button
              type="button"
              className="vpager-btn"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label={t.t("viewer.prevPage")}
              data-testid="viewer-prev"
            >
              ‹
            </button>
            <span data-testid="viewer-pagenum">
              {t.t("viewer.pageOf", { page: currentPage, total: pageCount })}
            </span>
            <button
              type="button"
              className="vpager-btn"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= pageCount}
              aria-label={t.t("viewer.nextPage")}
              data-testid="viewer-next"
            >
              ›
            </button>
          </div>
        )}
      </header>

      <div className="vscroll" ref={bodyRef} data-testid="viewer-body">
        {loading && <p className="viewer-msg">{t.t("viewer.loading")}</p>}
        {missing && (
          <p className="viewer-msg" data-testid="viewer-missing">
            {t.t("viewer.missing")}
          </p>
        )}
        {!loading && !missing && content && isMedia && target && (
          <div className="vaudio" data-testid="viewer-audio-player">
            {isVideo ? (
              <video
                ref={(el) => {
                  audioRef.current = el;
                }}
                controls
                preload="metadata"
                className="vvideo-el"
                data-testid="viewer-video-el"
                src={mediaSrc(target.sourceId)}
                onError={() => setAudioError(true)}
              />
            ) : (
              <audio
                ref={(el) => {
                  audioRef.current = el;
                }}
                controls
                preload="metadata"
                className="vaudio-el"
                src={mediaSrc(target.sourceId)}
                onError={() => setAudioError(true)}
              />
            )}
            {audioError && (
              <p className="vaudio-err" data-testid="viewer-audio-error">
                {t.t(isVideo ? "viewer.videoError" : "viewer.audioError")}
              </p>
            )}
            {audioError && (
              <RelinkPrompt
                key={target.sourceId}
                sourceId={target.sourceId}
                onRelinked={onRelinked}
              />
            )}
          </div>
        )}
        {!loading && !missing && content && isImage && target && (
          <div className="vimage" data-testid="viewer-image-player">
            <div className="vimage-frame">
              <img
                className="vimage-el"
                data-testid="viewer-image-el"
                src={mediaSrc(target.sourceId)}
                alt={content.title}
                onError={() => setAudioError(true)}
              />
              {bbox && (
                <div
                  className="vbbox"
                  data-testid="viewer-bbox"
                  style={{
                    left: `${bbox.x * 100}%`,
                    top: `${bbox.y * 100}%`,
                    width: `${bbox.w * 100}%`,
                    height: `${bbox.h * 100}%`,
                  }}
                />
              )}
            </div>
            {audioError && (
              <p className="vaudio-err" data-testid="viewer-image-error">
                {t.t("viewer.imageError")}
              </p>
            )}
            {audioError && (
              <RelinkPrompt
                key={target.sourceId}
                sourceId={target.sourceId}
                onRelinked={onRelinked}
              />
            )}
          </div>
        )}
        {!loading && !missing && content && (
          <div className="vtext">
            {blocks.length === 0 && (
              <span className="viewer-msg">{t.t("viewer.empty")}</span>
            )}
            {blocks.map((b, i) => {
              const mark = b.kind === "table" ? b.pageMark : undefined;
              const pageMarkEl = (page: number) => (
                <span
                  className="pagemark"
                  ref={(el) => {
                    if (el) pageRefs.current.set(page, el);
                  }}
                >
                  {t.t("viewer.pageMark", { page })}
                </span>
              );
              if (b.kind === "table") {
                const index = tableIndex(blocks, i);
                return (
                  <Fragment key={i}>
                    {mark !== undefined && pageMarkEl(mark)}
                    <SourceTable
                      block={b}
                      index={index}
                      label={t.t("viewer.table.label", {
                        i: index,
                        page: pageOf(content.pageBreaks, b.table.start),
                      })}
                      citationN={citation?.n ?? null}
                      firstRef={hlRef}
                    />
                  </Fragment>
                );
              }
              return b.segments.map((s, k) => (
                <span key={`${i}-${k}`}>
                  {s.pageMark !== undefined && pageMarkEl(s.pageMark)}
                  <SegmentText
                    s={s}
                    citationN={citation?.n ?? null}
                    firstRef={hlRef}
                  />
                </span>
              ));
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

/**
 * 101: nút "Chọn lại tệp gốc…" + giải thích khi tệp chọn không khớp. Hook nằm TRONG component và gắn `key=sourceId`
 * ⇒ thông báo của nguồn trước không dính sang nguồn khác. Thông báo đã được announce() đọc (091) nên không đặt
 * role=alert (tránh đọc 2 lần).
 */
function RelinkPrompt({
  sourceId,
  onRelinked,
}: {
  sourceId: string;
  onRelinked: () => void;
}): JSX.Element {
  const t = useT();
  const { relink, busy, message } = useRelink();
  return (
    <div className="vrelink">
      <button
        type="button"
        className="btn-outline-sm"
        disabled={busy}
        onClick={() =>
          void relink(sourceId).then((s) => s === "ok" && onRelinked())
        }
        data-testid="viewer-relink"
      >
        {busy ? t.t("sources.relink.checking") : t.t("sources.item.relink")}
      </button>
      {message && <p className="vrelink-msg">{message}</p>}
    </div>
  );
}

// 147 (e): lựa chọn dạng xem bảng — nhớ trong phiên (sessionStorage có thể bị chặn ⇒ mặc định lưới).
type TableView = "grid" | "text";
const VIEW_KEY = "iv.viewer.tableView";

function readTableView(): TableView {
  try {
    return sessionStorage.getItem(VIEW_KEY) === "text" ? "text" : "grid";
  } catch {
    return "grid";
  }
}

function writeTableView(v: TableView): void {
  try {
    sessionStorage.setItem(VIEW_KEY, v);
  } catch {
    // không lưu được — chỉ áp trong lần mở này
  }
}

/** Số thứ tự (1-based) của bảng tại khối `i`. */
function tableIndex(blocks: ViewerBlock[], i: number): number {
  let n = 0;
  for (let k = 0; k <= i; k++) if (blocks[k].kind === "table") n++;
  return n;
}

/** Trang chứa vị trí `offset` (mốc trang cuối cùng ≤ offset); không có mốc ⇒ 1. */
function pageOf(
  pageBreaks: readonly { page: number; offset: number }[],
  offset: number,
): number {
  let page = 1;
  for (const pb of pageBreaks) if (pb.offset <= offset) page = pb.page;
  return page;
}
