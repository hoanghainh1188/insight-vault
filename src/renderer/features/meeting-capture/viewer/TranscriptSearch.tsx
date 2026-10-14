import { useT } from "../../../shared/i18n/i18n-context";

// 186 PR C2 (T141) — ô tìm trong transcript: đếm "k/N", trước/sau, Enter / Shift+Enter. Trình đọc màn hình nghe "Kết quả k trên N"
// (live region lịch sự trong ô đếm — chỉ đổi khi người dùng chuyển kết quả).

export function TranscriptSearch({
  query,
  onQuery,
  count,
  current,
  onMove,
}: {
  query: string;
  onQuery(q: string): void;
  count: number;
  current: number;
  onMove(delta: 1 | -1): void;
}): JSX.Element {
  const t = useT();
  const has = count > 0;
  return (
    <div className="mview-search" role="search">
      <input
        type="search"
        className="nb-input"
        value={query}
        maxLength={200}
        placeholder={t.t("meeting.viewer.searchPlaceholder")}
        aria-label={t.t("meeting.viewer.searchLabel")}
        onChange={(e) => onQuery(e.target.value)}
        onKeyDown={(e) => {
          // Esc xoá ô tìm thay vì đóng cả trình xem (SourceViewer nghe Esc ở window) — review C2.
          if (e.key === "Escape" && query !== "") {
            e.stopPropagation();
            e.nativeEvent.stopPropagation();
            onQuery("");
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            onMove(e.shiftKey ? -1 : 1);
          }
        }}
        data-testid="meeting-search"
      />
      {query.trim() !== "" && (
        <span className="mview-count" data-testid="meeting-search-count">
          {has
            ? t.t("meeting.viewer.resultCount", { k: current + 1, n: count })
            : t.t("meeting.viewer.noResult")}
        </span>
      )}
      {/* Trình đọc màn hình: "Kết quả k trên N" (role=status, chỉ chữ — review C2). */}
      <span className="sr-only" role="status">
        {query.trim() === ""
          ? ""
          : has
            ? t.t("meeting.viewer.resultA11y", { k: current + 1, n: count })
            : t.t("meeting.viewer.noResult")}
      </span>
      <button
        type="button"
        className="btn-icon-sm"
        disabled={!has}
        aria-label={t.t("meeting.viewer.prev")}
        onClick={() => onMove(-1)}
        data-testid="meeting-search-prev"
      >
        ‹
      </button>
      <button
        type="button"
        className="btn-icon-sm"
        disabled={!has}
        aria-label={t.t("meeting.viewer.next")}
        onClick={() => onMove(1)}
        data-testid="meeting-search-next"
      >
        ›
      </button>
    </div>
  );
}
