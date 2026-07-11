import type { Citation, StudioKind } from "@shared/ipc/types";
import { useStudio } from "./useStudio";
import { StudioResultCard } from "./StudioResultCard";
import "./studio.css";

// Cột Studio (prototype S2, cột 3). 4 nút "Tạo nhanh" → sinh bản tổng hợp toàn notebook. Nút vô hiệu khi
// chưa có nguồn ready hoặc model chưa sẵn sàng (FR-010/011). Kết quả hiển thị card + chip [n] (kiểm chứng).

const KINDS: { kind: StudioKind; label: string }[] = [
  { kind: "summary", label: "Tóm tắt tài liệu" },
  { kind: "keyPoints", label: "Ý chính" },
  { kind: "faq", label: "FAQ" },
  { kind: "outline", label: "Dàn ý" },
];

interface StudioColumnProps {
  notebookId: string;
  onCite?: (c: Citation) => void;
}

export function StudioColumn({
  notebookId,
  onCite,
}: StudioColumnProps): JSX.Element {
  const { results, loading, errors, generate, ollamaReady, hasReadySources } =
    useStudio(notebookId);

  const blockReason =
    ollamaReady === false
      ? "Mô hình AI chưa sẵn sàng. Kiểm tra Cài đặt để chọn mô hình."
      : !hasReadySources
        ? "Nạp nguồn để tạo Studio."
        : null;
  const disabled = blockReason !== null;

  return (
    <section
      className="studio-col"
      aria-label="Studio"
      data-testid="studio-col"
    >
      <h2 className="studio-title">Studio</h2>
      <p className="col-hint">Tạo nhanh bản tổng hợp từ nguồn của notebook.</p>

      {blockReason && (
        <p className="studio-block" data-testid="studio-block">
          {blockReason}
        </p>
      )}

      <div className="studio-actions">
        {KINDS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            className="studio-btn"
            onClick={() => generate(kind)}
            disabled={disabled || loading[kind] === true}
            data-testid={`studio-btn-${kind}`}
          >
            {loading[kind] ? "Đang tạo…" : label}
          </button>
        ))}
      </div>

      <div className="studio-results">
        {KINDS.map(({ kind }) => {
          const err = errors[kind];
          const res = results[kind];
          if (err) {
            return (
              <p
                key={kind}
                className="studio-error"
                data-testid={`studio-error-${kind}`}
              >
                {err}
              </p>
            );
          }
          if (!res) return null;
          return (
            <StudioResultCard
              key={kind}
              result={res}
              regenerating={loading[kind] === true}
              onRegenerate={() => generate(kind)}
              onCite={onCite}
            />
          );
        })}
      </div>
    </section>
  );
}
