import { useT } from "../../shared/i18n/i18n-context";
import { useRerankerStatus } from "./useRerankerStatus";

// 109 (FR-016): một dòng trạng thái bộ chấm độ liên quan trong Cài đặt › AI. Không dùng (unavailable) / IPC lỗi ⇒ ẩn.
export function SettingsRerankerStatus(): JSX.Element | null {
  const t = useT();
  const status = useRerankerStatus();
  if (status === null || status === "unavailable") return null;
  return (
    <p
      className="ai-embed-note"
      data-testid="reranker-status"
      data-state={status}
    >
      <strong>{t.t("ai.reranker.title")}:</strong>{" "}
      {t.t(`ai.reranker.status.${status}`)}
    </p>
  );
}
