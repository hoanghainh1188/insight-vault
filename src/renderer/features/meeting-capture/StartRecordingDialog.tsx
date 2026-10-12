import { useEffect, useRef, useState } from "react";
import type {
  LanguageMode,
  MeetingPrepareResult,
  Notebook,
} from "@shared/ipc/types";
import { intlLocaleOf } from "@shared/i18n";
import { useModalA11y } from "../../shared/useModalA11y";
import { IconClose } from "../../shared/icons";
import { useLang, useT } from "../../shared/i18n/i18n-context";
import {
  describeIpcError,
  toParsedError,
} from "../../shared/i18n/describe-error";
import { meetingTitleParts } from "./default-title";
import { useRecording } from "./RecordingProvider";

// 186 — hộp "Ghi cuộc họp" (FR-002..FR-005, C6): tên mặc định, notebook đích, micro (khi > 1), ngôn ngữ, thông điệp riêng
// tư đúng sự thật, Bắt đầu ghi. Từ chối quyền ⇒ hướng dẫn theo hệ điều hành, KHÔNG tạo nguồn. Lựa chọn lần trước lưu ở
// main (electron-store — D15).

const LANGS: LanguageMode[] = ["auto", "vi", "en", "multi"];
const isMac = (): boolean => /Mac/i.test(navigator.userAgent);

export function StartRecordingDialog({
  notebookId,
  onClose,
}: {
  notebookId: string;
  onClose: () => void;
}): JSX.Element {
  const t = useT();
  const lang = useLang();
  const rec = useRecording();
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y({ active: true, onClose, containerRef: ref });

  const [prep, setPrep] = useState<MeetingPrepareResult | null>(null);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[] | null>(null);
  const [title, setTitle] = useState(() => {
    const p = meetingTitleParts(new Date(), intlLocaleOf(lang));
    return t.t("meeting.start.defaultName", { date: p.date, time: p.time });
  });
  const [target, setTarget] = useState(notebookId);
  const [deviceId, setDeviceId] = useState("");
  const [languageMode, setLanguageMode] = useState<LanguageMode>("auto");
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let alive = true;
    void window.api.meetingPrepare({ notebookId }).then((p) => {
      if (!alive) return;
      setPrep(p);
      if (p.lastLanguageMode) setLanguageMode(p.lastLanguageMode);
      if (p.micStatus === "denied" || p.micStatus === "restricted")
        setDenied(true);
    });
    void window.api.notebookList().then((list) => alive && setNotebooks(list));
    void navigator.mediaDevices
      ?.enumerateDevices()
      .then((all) => {
        if (!alive) return;
        const inputs = all.filter(
          (d) => d.kind === "audioinput" && d.deviceId !== "default",
        );
        setMics(inputs);
      })
      .catch(() => alive && setMics([]));
    return () => {
      alive = false;
    };
  }, [notebookId]);

  // Chọn lại micro lần trước theo nhãn (deviceId thay đổi theo phiên trình duyệt).
  useEffect(() => {
    if (!prep?.lastDeviceLabel || !mics) return;
    const hit = mics.find((m) => m.label === prep.lastDeviceLabel);
    if (hit) setDeviceId(hit.deviceId);
  }, [prep, mics]);

  const fake = prep?.testFakeMic === true;
  const noMic = !fake && mics !== null && mics.length === 0;
  const diskLow = prep !== null && prep.minutesRemaining < 10;
  const canBegin =
    prep !== null &&
    prep.canStart &&
    !noMic &&
    !denied &&
    title.trim() !== "" &&
    !rec.busy;

  const begin = async (): Promise<void> => {
    setError(null);
    const r = await rec.start({
      notebookId: target,
      title,
      languageMode,
      ...(deviceId ? { deviceId } : {}),
    });
    if (r.ok) onClose();
    else if (r.reason === "denied") setDenied(true);
    else if (r.reason === "notFound") setError(t.t("meeting.start.noMic"));
    else if (r.reason === "ipc")
      setError(describeIpcError(toParsedError(r.error), t));
    else setError(t.t("meeting.capture.failed"));
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      data-testid="meeting-start-dialog"
    >
      <div
        className="modal meeting-start"
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-start-title"
      >
        <button
          type="button"
          className="modal-x"
          onClick={onClose}
          aria-label={t.t("common.close")}
        >
          <IconClose size={16} />
        </button>
        <h3 id="meeting-start-title">{t.t("meeting.start.title")}</h3>

        <label className="ms-field">
          <span>{t.t("meeting.start.nameLabel")}</span>
          <input
            className="nb-input"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            data-testid="meeting-title"
          />
        </label>

        <label className="ms-field">
          <span>{t.t("meeting.start.notebookLabel")}</span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            data-testid="meeting-notebook"
          >
            {notebooks.length === 0 && <option value={notebookId}>…</option>}
            {notebooks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </label>

        {!fake && mics !== null && mics.length > 1 && (
          <label className="ms-field">
            <span>{t.t("meeting.start.micLabel")}</span>
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              data-testid="meeting-mic"
            >
              <option value="">{t.t("meeting.start.defaultMic")}</option>
              {mics.map((m, i) => (
                <option key={m.deviceId} value={m.deviceId}>
                  {m.label || `${t.t("meeting.start.micLabel")} ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="ms-field">
          <span>{t.t("meeting.start.languageLabel")}</span>
          <select
            value={languageMode}
            onChange={(e) => setLanguageMode(e.target.value as LanguageMode)}
            data-testid="meeting-language"
          >
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {t.t(`meeting.language.${l}`)}
              </option>
            ))}
          </select>
        </label>

        <div className="ms-privacy" data-testid="meeting-privacy">
          <p>{t.t("meeting.start.privacy")}</p>
          {prep?.onlineActive && (
            <p className="ms-note">{t.t("meeting.start.privacyOnline")}</p>
          )}
          {prep && !prep.modelReady && (
            <p className="ms-note">
              {t.t("meeting.start.modelMissing", { size: prep.modelSizeMb })}
            </p>
          )}
        </div>

        {denied && (
          <p className="form-error" role="alert" data-testid="meeting-denied">
            {t.t(
              isMac()
                ? "meeting.permission.deniedMac"
                : "meeting.permission.deniedWin",
            )}
          </p>
        )}
        {noMic && (
          <p className="form-error" role="alert" data-testid="meeting-no-mic">
            {t.t("meeting.start.noMic")}
          </p>
        )}
        {diskLow && (
          <p className="form-error" role="alert" data-testid="meeting-disk-low">
            {t.t("meeting.start.diskLow", {
              minutes: prep?.minutesRemaining ?? 0,
            })}
          </p>
        )}
        {prep?.recordingActive && (
          <p className="form-error" role="alert">
            {t.t("errors.meetingAlreadyRecording")}
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {t.t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn-primary-sm"
            disabled={!canBegin}
            onClick={() => void begin()}
            data-testid="meeting-begin"
          >
            {rec.busy
              ? t.t("meeting.start.starting")
              : t.t("meeting.start.begin")}
          </button>
        </div>
      </div>
    </div>
  );
}
