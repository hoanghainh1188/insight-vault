import { useState } from "react";
import type { MeetingMarker, MeetingMarkerKind } from "@shared/ipc/types";
import { formatDuration } from "@shared/meeting/format-duration";
import { useT } from "../../../shared/i18n/i18n-context";
import { PopoverMenu } from "../PopoverMenu";

// 186 PR C2 (T142) — danh sách đánh dấu trong trình xem: nhãn + mốc + trích đoạn; bấm ⇒ tua; đổi nhãn (menu — chỉ khi chọn
// mục); xoá có xác nhận. Main kiểm đánh dấu thuộc nguồn cuộc họp.

const KINDS: readonly MeetingMarkerKind[] = [
  "decision",
  "actionItem",
  "question",
];

export function MarkerList({
  markers,
  onSeek,
  onChanged,
}: {
  markers: readonly (MeetingMarker & { excerpt: string })[];
  onSeek(sec: number): void;
  onChanged(): void;
}): JSX.Element | null {
  const t = useT();
  const [confirm, setConfirm] = useState<MeetingMarker | null>(null);
  if (markers.length === 0) return null;

  const kindLabel = (k: MeetingMarkerKind): string =>
    t.t(`meeting.marker.${k}`);

  return (
    <section
      className="mview-markers"
      aria-label={t.t("meeting.viewer.markers")}
      data-testid="meeting-markers"
    >
      <h3>{t.t("meeting.viewer.markers")}</h3>
      <ul>
        {markers.map((m) => (
          <li key={m.id} className={`mview-marker kind-${m.kind}`}>
            <button
              type="button"
              className="mview-marker-main"
              onClick={() => onSeek(m.tStart)}
              data-testid="meeting-marker"
            >
              <span className="mview-marker-kind">{kindLabel(m.kind)}</span>
              <span className="mview-marker-time">
                {formatDuration(m.tStart)}
              </span>
              {m.excerpt && (
                <span className="mview-marker-excerpt">{m.excerpt}</span>
              )}
            </button>
            <PopoverMenu
              label={t.t("meeting.viewer.changeKind")}
              menuLabel={t.t("meeting.viewer.changeKind")}
              testId="meeting-marker-kind"
              items={KINDS.filter((k) => k !== m.kind).map((k) => ({
                key: k,
                label: kindLabel(k),
                testId: `meeting-marker-kind-${k}`,
                onSelect: () =>
                  void window.api
                    .meetingUpdateMarker({ markerId: m.id, kind: k })
                    .then(onChanged, () => undefined),
              }))}
            />
            <button
              type="button"
              className="btn-icon-sm"
              aria-label={t.t("meeting.viewer.deleteMarker")}
              onClick={() => setConfirm(m)}
              data-testid="meeting-marker-delete"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {confirm && (
        <div
          className="nb-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="marker-del-title"
          data-testid="meeting-marker-delete-confirm"
        >
          <div className="nb-modal">
            <h3 id="marker-del-title">
              {t.t("meeting.viewer.deleteConfirmTitle")}
            </h3>
            <p>
              {t.t("meeting.viewer.deleteConfirmBody", {
                kind: kindLabel(confirm.kind),
                time: formatDuration(confirm.tStart),
              })}
            </p>
            <div className="nb-modal-actions">
              <button
                type="button"
                className="btn-sm"
                onClick={() => setConfirm(null)}
              >
                {t.t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn-danger-sm"
                onClick={() => {
                  const id = confirm.id;
                  setConfirm(null);
                  void window.api
                    .meetingDeleteMarker({ markerId: id })
                    .then(onChanged, () => undefined);
                }}
                data-testid="meeting-marker-delete-ok"
              >
                {t.t("meeting.viewer.deleteConfirmOk")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
