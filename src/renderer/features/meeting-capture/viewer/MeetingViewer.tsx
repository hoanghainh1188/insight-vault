import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MeetingTranscript, PauseGap } from "@shared/ipc/types";
import { formatDuration } from "@shared/meeting/format-duration";
import { spanAtTime } from "@shared/meeting/span-at-time";
import { announce } from "../../../shared/a11y/announcer";
import { useT } from "../../../shared/i18n/i18n-context";
import {
  describeIpcError,
  toParsedError,
} from "../../../shared/i18n/describe-error";
import { MarkerList } from "./MarkerList";
import { TranscriptSearch } from "./TranscriptSearch";
import { searchTranscript } from "./transcript-search";
import {
  gapsBefore,
  matchesBySpan,
  plainTranscript,
  spanOfMatch,
  splitSpan,
  trailingGaps,
  type Span,
} from "./viewer-text";
import type { TextMatch } from "./transcript-search";

// 186 PR C2 (US7, T140–T143) — trình xem cuộc họp trong cột xem nguồn: transcript theo câu (bấm ⇒ tua, giữ trạng thái phát/dừng),
// câu đang phát `aria-current` + tô (theo `timeupdate` của player cố định ở đầu — player do SourceViewer giữ), tự cuộn theo khi
// người dùng không tự cuộn, dòng phân cách tạm dừng, tìm trong transcript, danh sách đánh dấu, sao chép, xuất Markdown. Trích
// dẫn [n] tô câu giao với đoạn trích như trình xem thường.

/** Người dùng vừa tự cuộn trong khoảng này ⇒ không tự cuộn theo câu đang phát. */
const USER_SCROLL_HOLD_MS = 4000;

export interface MeetingViewerProps {
  sourceId: string;
  text: string;
  audio: React.RefObject<HTMLMediaElement | null>;
  highlight: { charStart: number; charEnd: number } | null;
}

export function MeetingViewer({
  sourceId,
  text,
  audio,
  highlight,
}: MeetingViewerProps): JSX.Element {
  const t = useT();
  const [data, setData] = useState<MeetingTranscript | null>(null);
  const [active, setActive] = useState(-1);
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const spanEls = useRef(new Map<number, HTMLElement>());
  const lastUserScroll = useRef(0);

  const load = (): void => {
    void window.api
      .meetingGetTranscript({ sourceId })
      .then(setData, (e: unknown) =>
        setError(describeIpcError(toParsedError(e), t)),
      );
  };
  useEffect(load, [sourceId]);

  const spans = useMemo(() => data?.spans ?? [], [data]);
  const gaps = useMemo(() => data?.pauseGaps ?? [], [data]);
  const matches = useMemo(() => searchTranscript(text, query), [text, query]);
  // Review C2 (hiệu năng 2 giờ): tính sẵn theo câu ⇒ mỗi dòng chỉ nhận phần của nó, dòng không đổi không render lại.
  const bySpan = useMemo(() => matchesBySpan(spans, matches), [spans, matches]);
  const gapRows = useMemo(
    () => spans.map((_, i) => gapsBefore(spans, gaps, i)),
    [spans, gaps],
  );
  const spansRef = useRef(spans);
  spansRef.current = spans;

  // Câu đang phát theo thời gian player.
  useEffect(() => {
    const el = audio.current;
    if (!el || spans.length === 0) return;
    const onTime = (): void => setActive(spanAtTime(spans, el.currentTime));
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("seeked", onTime);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("seeked", onTime);
    };
  }, [audio, spans]);

  // Tự cuộn theo câu đang phát khi người dùng không vừa tự cuộn.
  useEffect(() => {
    if (active < 0 || Date.now() - lastUserScroll.current < USER_SCROLL_HOLD_MS)
      return;
    spanEls.current.get(active)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Trích dẫn [n]: cuộn tới câu đầu tiên giao với đoạn trích.
  const hlFirst = highlight
    ? spans.findIndex(
        (s) =>
          s.charStart < highlight.charEnd && s.charEnd > highlight.charStart,
      )
    : -1;
  useEffect(() => {
    if (hlFirst >= 0)
      spanEls.current.get(hlFirst)?.scrollIntoView({ block: "center" });
  }, [hlFirst]);

  // Kết quả tìm hiện tại ⇒ cuộn tới câu chứa nó.
  useEffect(() => {
    const i = spanOfMatch(spans, matches[current]);
    if (i >= 0) spanEls.current.get(i)?.scrollIntoView({ block: "center" });
  }, [current, matches]);

  const seek = useCallback(
    (sec: number): void => {
      const el = audio.current;
      if (el) el.currentTime = sec; // giữ nguyên đang phát / đang dừng
      // Media chưa tải xong thì không có sự kiện `seeked` ⇒ cập nhật câu đang phát ngay.
      setActive(spanAtTime(spansRef.current, sec));
    },
    [audio],
  );
  const registerEl = useCallback((i: number, el: HTMLElement | null) => {
    if (el) spanEls.current.set(i, el);
    else spanEls.current.delete(i);
  }, []);
  // Review C2: mọi cách người dùng tự di chuyển (lăn, chạm, kéo thanh cuộn, phím, Tab vào câu) ⇒ tạm ngừng tự cuộn.
  const holdFollow = (): void => {
    lastUserScroll.current = Date.now();
  };

  const gapLabel = (g: PauseGap): string =>
    `— ${t.t(`meeting.export.gap.${g.reason}`, {
      duration: formatDuration(g.wallSeconds),
    })} —`;

  const copy = async (): Promise<void> => {
    try {
      await window.api.clipboardWrite(
        plainTranscript(text, spans, gaps, gapLabel),
      );
      announce(t.t("meeting.viewer.copied"));
    } catch (e) {
      setError(describeIpcError(toParsedError(e), t));
    }
  };

  const exportMd = async (): Promise<void> => {
    try {
      const r = await window.api.meetingExportMarkdown({ sourceId });
      if (r.saved && r.path)
        announce(
          t.t("meeting.viewer.exported", {
            path: r.path.split(/[\\/]/).pop() ?? r.path,
          }),
        );
    } catch (e) {
      setError(describeIpcError(toParsedError(e), t));
    }
  };

  if (error)
    return (
      <p className="form-error" role="alert">
        {error}
      </p>
    );
  if (!data) return <p className="viewer-msg">{t.t("viewer.loading")}</p>;

  return (
    <div className="mview" data-testid="meeting-viewer">
      <div className="mview-tools">
        <TranscriptSearch
          query={query}
          onQuery={(q) => {
            setQuery(q);
            setCurrent(0);
          }}
          count={matches.length}
          current={current}
          onMove={(d) =>
            setCurrent((c) =>
              matches.length === 0
                ? 0
                : (c + d + matches.length) % matches.length,
            )
          }
        />
        <button
          type="button"
          className="btn-outline-sm"
          disabled={spans.length === 0}
          onClick={() => void copy()}
          data-testid="meeting-copy"
        >
          {t.t("meeting.viewer.copy")}
        </button>
        <button
          type="button"
          className="btn-outline-sm"
          onClick={() => void exportMd()}
          data-testid="meeting-export"
        >
          {t.t("meeting.viewer.export")}
        </button>
      </div>

      <MarkerList markers={data.markers} onSeek={seek} onChanged={load} />

      {spans.length === 0 ? (
        <p className="viewer-msg">{t.t("meeting.viewer.empty")}</p>
      ) : (
        <ol
          className="mview-list"
          aria-label={t.t("meeting.viewer.transcript")}
          onWheel={holdFollow}
          onTouchMove={holdFollow}
          onPointerDown={holdFollow}
          onKeyDown={holdFollow}
          onFocus={holdFollow}
          data-testid="meeting-transcript"
        >
          {spans.map((s, i) => (
            <Fragment key={s.charStart}>
              {gapRows[i]?.map((g) => (
                <GapRow key={`g${g.atSec}`} label={gapLabel(g)} />
              ))}
              <SpanRow
                index={i}
                span={s}
                text={text}
                playing={i === active}
                hl={
                  highlight !== null &&
                  s.charStart < highlight.charEnd &&
                  s.charEnd > highlight.charStart
                }
                matches={bySpan[i] ?? NO_MATCHES}
                current={
                  bySpan[i]?.some((m) => m.index === current) ? current : -1
                }
                seekLabel={t.t("meeting.viewer.seekTo", {
                  time: formatDuration(s.tStart),
                })}
                onSeek={seek}
                register={registerEl}
              />
            </Fragment>
          ))}
          {trailingGaps(spans, gaps).map((g) => (
            <GapRow key={`g${g.atSec}`} label={gapLabel(g)} />
          ))}
        </ol>
      )}
    </div>
  );
}

const NO_MATCHES: readonly (TextMatch & { index: number })[] = [];

/** Dòng phân cách tạm dừng — đọc được bằng trình đọc màn hình (review C2). */
function GapRow({ label }: { label: string }): JSX.Element {
  return (
    <li className="mview-gap" role="separator" aria-label={label}>
      {label}
    </li>
  );
}

interface SpanRowProps {
  index: number;
  span: Span;
  text: string;
  playing: boolean;
  hl: boolean;
  matches: readonly (TextMatch & { index: number })[];
  current: number;
  seekLabel: string;
  onSeek(sec: number): void;
  register(i: number, el: HTMLElement | null): void;
}

/** Một câu transcript — memo: chỉ render lại khi chính nó đổi (đang phát, tô, kết quả tìm). */
const SpanRow = memo(function SpanRow({
  index,
  span,
  text,
  playing,
  hl,
  matches,
  current,
  seekLabel,
  onSeek,
  register,
}: SpanRowProps): JSX.Element {
  return (
    <li
      ref={(el) => register(index, el)}
      className={["mview-span", playing ? "playing" : "", hl ? "hl" : ""].join(
        " ",
      )}
      aria-current={playing ? "true" : undefined}
      data-testid="meeting-span"
    >
      <button
        type="button"
        className="mview-time"
        aria-label={seekLabel}
        onClick={() => onSeek(span.tStart)}
      >
        {formatDuration(span.tStart)}
      </button>
      <span
        className="mview-text"
        onClick={() => {
          // Đang bôi đen để sao chép ⇒ không tua (review C2).
          if (window.getSelection()?.isCollapsed === false) return;
          onSeek(span.tStart);
        }}
      >
        {splitSpan(text, span, matches).map((p, k) =>
          p.match === null ? (
            <Fragment key={k}>{p.text}</Fragment>
          ) : (
            <mark key={k} className={p.match === current ? "current" : ""}>
              {p.text}
            </mark>
          ),
        )}
      </span>
    </li>
  );
});
