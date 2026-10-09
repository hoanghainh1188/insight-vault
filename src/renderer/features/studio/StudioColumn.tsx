import { Fragment, useEffect, useRef, useState } from "react";
import type { AiTarget, Citation, StudioKind } from "@shared/ipc/types";
import { useStudio } from "./useStudio";
import { StudioResultCard } from "./StudioResultCard";
import { StudioProgress } from "./StudioProgress";
import {
  progressAnnouncement,
  type StudioProgressMap,
} from "./studio-progress";
import { announce } from "../../shared/a11y/announcer";
import { studioMessage } from "../../shared/a11y/messages";
import { useT } from "../../shared/i18n/i18n-context";
import { describeIpcError } from "../../shared/i18n/describe-error";
import "./studio.css";

// Cột Studio (prototype S2, cột 3). 4 nút "Tạo nhanh" → sinh bản tổng hợp toàn notebook. Nút vô hiệu khi
// chưa có nguồn ready hoặc model chưa sẵn sàng (FR-010/011). Kết quả hiển thị card + chip [n] (kiểm chứng).

// 123: nhãn loại lấy từ MỘT chỗ — khoá `studio.kind.<kind>` (dịch lúc render).
const KINDS: readonly StudioKind[] = ["summary", "keyPoints", "faq", "outline"];

interface StudioColumnProps {
  notebookId: string;
  onCite?: (c: Citation) => void;
}

export function StudioColumn({
  notebookId,
  onCite,
}: StudioColumnProps): JSX.Element {
  const {
    results,
    loading,
    errors,
    onlineFailed,
    localKinds,
    progress,
    generate,
    ollamaReady,
    hasReadySources,
    readySources,
  } = useStudio(notebookId);
  const t = useT();
  // 123: translator HIỆN TẠI cho câu báo xong (về sau await — người dùng có thể đã đổi ngôn ngữ).
  const trRef = useRef(t);
  trRef.current = t;
  // 146 (clarify #5): báo trình đọc màn hình khi tiến độ của một loại đổi pha / tới mốc giữa (polite, có tên loại).
  const prevProgress = useRef<StudioProgressMap>({});
  useEffect(() => {
    const tr = trRef.current;
    for (const kind of KINDS) {
      const next = progress[kind];
      const prev = prevProgress.current[kind];
      if (next && next !== prev) {
        const msg = progressAnnouncement(
          prev,
          next,
          tr.t(`studio.kind.${kind}`),
          tr,
        );
        if (msg) announce(msg);
      }
    }
    prevProgress.current = progress;
  }, [progress]);
  // Phạm vi tổng hợp (US2): "" = tất cả nguồn; else sourceId.
  const [scope, setScope] = useState("");
  const scopeId = scope === "" ? undefined : scope;

  const blockReason =
    ollamaReady === false
      ? t.t("studio.blockModel")
      : !hasReadySources
        ? t.t("studio.blockNoSources")
        : null;
  const disabled = blockReason !== null;
  // 098: khối lỗi (chứa nút vừa bấm) biến mất khi tạo lại ⇒ đưa focus về tiêu đề cột Studio.
  const titleRef = useRef<HTMLHeadingElement>(null);

  // 091: báo trình đọc màn hình lúc bắt đầu/xong (Studio chờ trọn kết quả — có thể mất vài chục giây).
  // 098: target "local" = tạo lại bằng AI cục bộ sau lỗi online (nút trong khối lỗi).
  const run = async (kind: StudioKind, target?: AiTarget): Promise<void> => {
    const tr = trRef.current;
    announce(studioMessage(tr.t(`studio.kind.${kind}`), "start", tr));
    if (await generate(kind, scopeId, target)) {
      const done = trRef.current;
      announce(studioMessage(done.t(`studio.kind.${kind}`), "done", done));
    }
  };

  return (
    <section
      className="studio-col"
      aria-label={t.t("studio.title")}
      data-testid="studio-col"
    >
      <h2 className="studio-title" ref={titleRef} tabIndex={-1}>
        {t.t("studio.title")}
      </h2>
      <p className="col-hint">{t.t("studio.hint")}</p>

      {blockReason && (
        <p className="studio-block" data-testid="studio-block">
          {blockReason}
        </p>
      )}

      {hasReadySources && readySources.length > 1 && (
        <label className="studio-scope">
          <span className="studio-scope-label">{t.t("studio.scope")}</span>
          <select
            className="studio-scope-select"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            data-testid="studio-scope"
          >
            <option value="">{t.t("studio.scopeAll")}</option>
            {readySources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="studio-actions">
        {KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className="studio-btn"
            onClick={() => void run(kind)}
            disabled={disabled || loading[kind] === true}
            data-testid={`studio-btn-${kind}`}
          >
            {loading[kind]
              ? t.t("studio.creating")
              : t.t(`studio.kind.${kind}`)}
          </button>
        ))}
      </div>

      <div className="studio-results">
        {KINDS.map((kind) => {
          const label = t.t(`studio.kind.${kind}`);
          const err = errors[kind];
          const res = results[kind];
          const prog = loading[kind] ? progress[kind] : undefined;
          // 146: đang tạo lần đầu và đã có tiến độ ⇒ dòng pha + thanh thay skeleton.
          if (prog && !res) {
            return <StudioProgress key={kind} kind={kind} progress={prog} />;
          }
          // Skeleton khi đang tạo lần đầu (chưa có kết quả cũ, chưa có tiến độ) — US3.
          if (loading[kind] && !res) {
            return (
              <div
                key={kind}
                className="studio-skeleton"
                data-testid={`studio-skeleton-${kind}`}
                aria-hidden="true"
              >
                <span className="sk-line" />
                <span className="sk-line" />
                <span className="sk-line short" />
              </div>
            );
          }
          if (err) {
            return (
              <div
                key={kind}
                className="studio-error"
                data-testid={`studio-error-${kind}`}
              >
                <p role="alert">{describeIpcError(err, t)}</p>
                {/* 098: lỗi AI online ⇒ người dùng chọn tạo bằng AI cục bộ cho lượt này, hoặc thử lại. */}
                {onlineFailed[kind] && (
                  <div className="fallback-actions">
                    <button
                      type="button"
                      className="btn-primary-sm"
                      aria-label={t.t("studio.localRetryAria", { kind: label })}
                      onClick={() => {
                        titleRef.current?.focus();
                        void run(kind, "local");
                      }}
                      data-testid={`studio-local-retry-${kind}`}
                    >
                      {t.t("studio.localRetry")}
                    </button>
                    <button
                      type="button"
                      className="btn-outline-sm"
                      aria-label={t.t("studio.retryAria", { kind: label })}
                      onClick={() => {
                        titleRef.current?.focus();
                        void run(kind);
                      }}
                      data-testid={`studio-retry-${kind}`}
                    >
                      {t.t("common.retry")}
                    </button>
                  </div>
                )}
              </div>
            );
          }
          if (!res) return null;
          return (
            <Fragment key={kind}>
              {/* 146: đang Tạo lại ⇒ tiến độ nằm trên card cũ (card vẫn đọc được). */}
              {prog && <StudioProgress kind={kind} progress={prog} onCard />}
              <StudioResultCard
                result={res}
                regenerating={loading[kind] === true}
                onRegenerate={() => void run(kind)}
                onCite={onCite}
                local={localKinds[kind] === true}
              />
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}
