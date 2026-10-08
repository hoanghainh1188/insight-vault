import { useCallback, useEffect, useRef, useState } from "react";
import {
  CRASH_REPORT_MAX_CHARS,
  CRASH_TITLE_MAX_CHARS,
} from "@shared/crash-report-limits";
import { useModalA11y } from "../useModalA11y";
import { useT } from "../i18n/i18n-context";
import "./crash-report-dialog.css";

interface CrashReportDialogProps {
  /** sent=true khi người dùng đã mở GitHub để gửi (main đã ghi nhận); false khi huỷ/đóng không gửi. */
  onClose: (sent: boolean) => void;
}

type Problem = "browser" | "throttled" | "copy" | null;

type Phase =
  | { kind: "loading" }
  | { kind: "loadFailed" }
  | { kind: "editing"; problem: Problem }
  | { kind: "sending" }
  | { kind: "sent" };

// 123: vấn đề → khoá dịch (dịch lúc render).
const PROBLEM_KEY = {
  browser: "crash.problem.browser",
  throttled: "crash.problem.throttled",
  copy: "crash.problem.copy",
} as const;

// 093 — hộp thoại "Báo lỗi" (ADR crash-report-clarify): người dùng XEM và SỬA toàn bộ bản nháp trước khi tự gửi.
// "Mở GitHub" chỉ mở trình duyệt tới trang tạo issue điền sẵn (đích cố định ở main) — app không tự gửi gì.
// Nằm ở shared vì dùng từ cả Cài đặt, dải thông báo và màn hình lỗi (ErrorFallback).
export function CrashReportDialog({
  onClose,
}: CrashReportDialogProps): JSX.Element {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>();

  // Đang gửi ⇒ không cho đóng (Escape/Huỷ): kết quả + ghi nhận ở main vẫn chạy, người dùng phải thấy kết quả.
  // `close` ỔN ĐỊNH qua các lần render (đọc qua ref): useModalA11y chạy lại effect khi onClose đổi và focus lại phần
  // tử đầu ⇒ nếu đổi mỗi lần gõ phím, focus sẽ nhảy khỏi ô đang nhập.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const close = useCallback((): void => {
    const k = phaseRef.current.kind;
    if (k !== "sending") onCloseRef.current(k === "sent");
  }, []);
  useModalA11y({ active: true, onClose: close, containerRef: ref });

  // Mỗi lần đổi pha, nếu focus không nằm trong hộp thoại (pha loading/loadFailed chưa có ô nhập, hoặc nút vừa bị
  // gỡ) ⇒ kéo focus về hộp thoại để trình đọc màn hình + Tab không lạc ra nền phía sau.
  useEffect(() => {
    const el = ref.current;
    if (el && !el.contains(document.activeElement)) el.focus();
  }, [phase.kind]);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  useEffect(() => {
    let alive = true;
    window.api
      .crashGetReport()
      .then((d) => {
        if (!alive) return;
        setTitle(d.title);
        setText(d.text);
        setPhase({ kind: "editing", problem: null });
      })
      .catch(() => alive && setPhase({ kind: "loadFailed" }));
    return () => {
      alive = false;
    };
  }, []);

  async function send(): Promise<void> {
    if (phase.kind !== "editing" || title.trim() === "") return;
    setPhase({ kind: "sending" });
    try {
      const r = await window.api.crashOpenIssue({ title, text });
      setPhase(
        r.ok
          ? { kind: "sent" }
          : {
              kind: "editing",
              problem: r.throttled ? "throttled" : "browser",
            },
      );
    } catch {
      setPhase({ kind: "editing", problem: "browser" });
    }
  }

  async function copy(): Promise<void> {
    try {
      await window.api.clipboardWrite(`${title}\n\n${text}`);
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setPhase({ kind: "editing", problem: "copy" });
    }
  }

  const editable = phase.kind === "editing" || phase.kind === "sending";
  const sending = phase.kind === "sending";

  return (
    <div
      className="nb-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crash-title"
      aria-busy={sending || undefined}
      data-testid="crash-dialog"
    >
      <div className="nb-modal crash-modal" ref={ref} tabIndex={-1}>
        <h3 id="crash-title">{t.t("crash.dialog.title")}</h3>

        {phase.kind === "loading" && (
          <p className="crash-desc" role="status">
            {t.t("crash.dialog.loading")}
          </p>
        )}

        {phase.kind === "loadFailed" && (
          <>
            <div className="nb-error" role="alert">
              {t.t("crash.dialog.loadFailed")}
            </div>
            <div className="nb-modal-actions">
              <button type="button" className="btn-sm" onClick={close}>
                {t.t("common.close")}
              </button>
            </div>
          </>
        )}

        {editable && (
          <>
            <p className="crash-desc">
              {t.t("crash.dialog.descBefore")}{" "}
              <strong>{t.t("crash.dialog.descStrong")}</strong>
              {t.t("crash.dialog.descAfter")}
            </p>
            <label className="nb-field-label" htmlFor="crash-title-input">
              {t.t("crash.dialog.titleLabel")}
            </label>
            <input
              id="crash-title-input"
              className="nb-input"
              value={title}
              maxLength={CRASH_TITLE_MAX_CHARS}
              readOnly={sending}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="crash-title"
            />
            <label className="nb-field-label" htmlFor="crash-text-input">
              {t.t("crash.dialog.textLabel")}
            </label>
            <textarea
              id="crash-text-input"
              className="nb-input crash-text"
              value={text}
              maxLength={CRASH_REPORT_MAX_CHARS}
              rows={12}
              spellCheck={false}
              readOnly={sending}
              onChange={(e) => setText(e.target.value)}
              data-testid="crash-text"
            />
            {phase.kind === "editing" && phase.problem && (
              <div className="nb-error" role="alert">
                {t.t(PROBLEM_KEY[phase.problem])}
              </div>
            )}
            <div className="nb-modal-actions crash-actions">
              <button
                type="button"
                className="btn-sm"
                aria-disabled={sending || undefined}
                onClick={close}
              >
                {t.t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn-outline-sm"
                onClick={() => void copy()}
                data-testid="crash-copy"
              >
                {copied ? t.t("common.copied") : t.t("common.copy")}
              </button>
              {/* aria-disabled thay vì disabled: nút đang có focus không bị gỡ focus (rơi ra nền) khi đang gửi. */}
              <button
                type="button"
                className="btn-primary-sm"
                aria-disabled={sending || title.trim() === "" || undefined}
                onClick={() => void send()}
                data-testid="crash-send"
              >
                {sending
                  ? t.t("crash.dialog.sending")
                  : t.t("crash.dialog.send")}{" "}
                <span aria-hidden="true">↗</span>
              </button>
            </div>
          </>
        )}

        {phase.kind === "sent" && (
          <>
            <p className="crash-desc" role="status" data-testid="crash-sent">
              {t.t("crash.dialog.sent")}
            </p>
            <div className="nb-modal-actions">
              <button type="button" className="btn-primary-sm" onClick={close}>
                {t.t("common.close")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
