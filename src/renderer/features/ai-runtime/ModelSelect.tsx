import type { Model } from "@shared/ipc/types";
import { formatNumber } from "@shared/i18n";
import { useLang, useT } from "../../shared/i18n/i18n-context";

// Danh sách model radio-select (theo prototype S5). Presentational: nhận models + selected + onSelect.
// 123: testid theo vai trò (kind) — KHÔNG theo nhãn (nhãn đổi theo ngôn ngữ).
export function ModelSelect({
  kind,
  label,
  models,
  selected,
  onSelect,
  emptyHint,
}: {
  kind: "chat" | "embedding";
  label: string;
  models: Model[];
  selected: string | null;
  onSelect: (name: string) => void;
  emptyHint?: string;
}): JSX.Element {
  const t = useT();
  const lang = useLang();
  return (
    <div className="model-select" data-testid={`model-select-${kind}`}>
      <div className="model-select-label">{label}</div>
      {models.length === 0 ? (
        <div className="model-hint">
          {emptyHint ?? t.t("ai.modelSelect.noModels")}
        </div>
      ) : (
        <div className="model-list">
          {models.map((m) => (
            <button
              key={m.name}
              type="button"
              className={`model-row${selected === m.name ? " sel" : ""}`}
              onClick={() => onSelect(m.name)}
              data-testid={`model-${m.name}`}
            >
              <span className="radio" />
              <span className="nm" title={m.name}>
                {m.name}
              </span>
              {m.sizeBytes != null && (
                <span className="sz mono">
                  {t.t("ai.modelSelect.sizeGb", {
                    size: formatNumber(m.sizeBytes / 1e9, lang, 1),
                  })}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
