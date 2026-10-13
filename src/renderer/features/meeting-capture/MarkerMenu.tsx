import { useEffect, useState } from "react";
import type { MeetingMarker, MeetingMarkerKind } from "@shared/ipc/types";
import { formatDuration } from "@shared/meeting/format-duration";
import { announce } from "../../shared/a11y/announcer";
import { useT } from "../../shared/i18n/i18n-context";
import { PopoverMenu } from "./PopoverMenu";

// 186 PR B (US4, FR-026/027) — nút Đánh dấu (3 nhãn) + danh sách đánh dấu gọn trong màn ghi. Có `range` (bôi chọn trong
// nháp) ⇒ đánh dấu khoảng; không ⇒ đánh dấu điểm tại thời điểm hiện tại. Main kiểm mọi giá trị.

const KINDS: readonly MeetingMarkerKind[] = [
  "decision",
  "actionItem",
  "question",
];

export interface MarkerMenuProps {
  sessionId: string;
  sourceId: string;
  durationSec: number;
  range: { tStart: number; tEnd: number } | null;
  onMarked(): void;
  openRequest?: number;
  keyshortcuts?: { aria: string; title: string };
}

export function MarkerMenu({
  sessionId,
  sourceId,
  durationSec,
  range,
  onMarked,
  openRequest,
  keyshortcuts,
}: MarkerMenuProps): JSX.Element {
  const t = useT();
  const [markers, setMarkers] = useState<readonly MeetingMarker[]>([]);

  const refresh = (): void => {
    void window.api
      .meetingListMarkers({ sourceId })
      .then(setMarkers, () => undefined);
  };
  useEffect(refresh, [sourceId]);

  const mark = async (kind: MeetingMarkerKind): Promise<void> => {
    try {
      await window.api.meetingMark({
        sessionId,
        kind,
        tStart: range?.tStart ?? durationSec,
        ...(range ? { tEnd: range.tEnd } : {}),
      });
      announce(
        t.t("meeting.a11y.marked", { kind: t.t(`meeting.marker.${kind}`) }),
      );
      onMarked();
      refresh();
    } catch {
      /* phiên vừa kết thúc — bỏ qua */
    }
  };

  return (
    <div className="rec-marker">
      <PopoverMenu
        label={
          range
            ? t.t("meeting.marker.selectionHint")
            : t.t("meeting.marker.add")
        }
        menuLabel={t.t("meeting.marker.menu")}
        testId="recording-mark"
        {...(openRequest !== undefined ? { openRequest } : {})}
        {...(keyshortcuts ? { keyshortcuts } : {})}
        items={KINDS.map((k) => ({
          key: k,
          label: t.t(`meeting.marker.${k}`),
          testId: `recording-mark-${k}`,
          onSelect: () => void mark(k),
        }))}
      />
      {markers.length > 0 && (
        <ul
          className="rec-marker-list"
          aria-label={t.t("meeting.marker.list")}
          data-testid="recording-markers"
        >
          {markers.map((m) => (
            <li key={m.id} className={`rec-marker-chip kind-${m.kind}`}>
              {t.t("meeting.marker.item", {
                kind: t.t(`meeting.marker.${m.kind}`),
                time: formatDuration(m.tStart),
              })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
