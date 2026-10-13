import { useEffect, useState } from "react";
import type { Source } from "@shared/ipc/types";
import { announce } from "../../shared/a11y/announcer";
import { useT } from "../../shared/i18n/i18n-context";
import {
  describeIpcError,
  toParsedError,
} from "../../shared/i18n/describe-error";

// 186 PR C1 (T121, FR-034/FR-036) — trong trình xem nguồn cuộc họp: chưa hoàn thiện ⇒ "Hoàn tất transcript"; đang dùng transcript
// nháp (không lập chỉ mục) ⇒ nhãn "Transcript nháp" + "Chốt lại". Cả hai gọi meeting:finalizeAgain; tiến độ qua source:progress.

export function MeetingSourceBanner({
  sourceId,
}: {
  sourceId: string;
}): JSX.Element | null {
  const t = useT();
  const [src, setSrc] = useState<Source | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = (): void => {
      void window.api.sourceGet(sourceId).then((s) => {
        if (alive) setSrc(s);
      });
    };
    load();
    const off = window.api.onSourceProgress((e) => {
      if (e.sourceId === sourceId && e.status !== "processing") load();
    });
    return () => {
      alive = false;
      off();
    };
  }, [sourceId]);

  if (!src || src.kind !== "meeting") return null;
  const incomplete = src.meetingPhase === "incomplete";
  const draft =
    src.meetingPhase === "done" && src.transcriptQuality === "draft";
  if (!incomplete && !draft) return null;

  const run = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await window.api.meetingFinalizeAgain({ sourceId });
      announce(t.t("meeting.sourceBanner.started"));
      setSrc((s) => (s ? { ...s, meetingPhase: "finalizing" } : s));
    } catch (e) {
      setError(describeIpcError(toParsedError(e), t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={draft ? "meeting-banner draft" : "meeting-banner"}
      data-testid="meeting-source-banner"
    >
      <p>
        {draft
          ? t.t("meeting.sourceBanner.draft")
          : t.t("meeting.sourceBanner.incomplete")}
      </p>
      <button
        type="button"
        className="btn-outline-sm"
        disabled={busy}
        onClick={() => void run()}
        data-testid="meeting-finalize-again"
      >
        {draft
          ? t.t("meeting.sourceBanner.finalizeDraft")
          : t.t("meeting.sourceBanner.finalizeIncomplete")}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
