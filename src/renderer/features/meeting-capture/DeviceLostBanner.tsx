import { useEffect, useState } from "react";
import { useT } from "../../shared/i18n/i18n-context";

// 186 PR C1 (T118, FR-040) — mất microphone khi đang ghi ⇒ main đã tạm dừng (gap deviceLost). Cho chọn thiết bị khác để
// tiếp tục CÙNG phiên, hoặc người dùng bấm Kết thúc ghi ở thanh dưới.

export function DeviceLostBanner({
  busy,
  onResume,
}: {
  busy: boolean;
  onResume(deviceId: string): void;
}): JSX.Element {
  const t = useT();
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");

  useEffect(() => {
    const load = (): void => {
      void navigator.mediaDevices
        ?.enumerateDevices()
        .then((all) => setMics(all.filter((d) => d.kind === "audioinput")))
        .catch(() => setMics([]));
    };
    load();
    navigator.mediaDevices?.addEventListener?.("devicechange", load);
    return () =>
      navigator.mediaDevices?.removeEventListener?.("devicechange", load);
  }, []);

  return (
    <div className="device-lost" role="alert" data-testid="device-lost">
      <p className="device-lost-title">{t.t("meeting.deviceLost.title")}</p>
      <p>{t.t("meeting.deviceLost.body")}</p>
      <div className="device-lost-row">
        <select
          aria-label={t.t("meeting.start.micLabel")}
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          data-testid="device-lost-select"
        >
          <option value="">{t.t("meeting.start.defaultMic")}</option>
          {mics.map((m, i) => (
            <option key={m.deviceId || i} value={m.deviceId}>
              {m.label || `${t.t("meeting.start.micLabel")} ${i + 1}`}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-primary-sm"
          disabled={busy}
          onClick={() => onResume(deviceId)}
          data-testid="device-lost-resume"
        >
          {t.t("meeting.deviceLost.resumeWith")}
        </button>
      </div>
    </div>
  );
}
