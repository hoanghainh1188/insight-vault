import type { Model } from "@shared/ipc/types";

// Danh sách model radio-select (theo prototype S5). Presentational: nhận models + selected + onSelect.
export function ModelSelect({
  label,
  models,
  selected,
  onSelect,
  emptyHint,
}: {
  label: string;
  models: Model[];
  selected: string | null;
  onSelect: (name: string) => void;
  emptyHint?: string;
}): JSX.Element {
  return (
    <div className="model-select" data-testid={`model-select-${label}`}>
      <div className="model-select-label">{label}</div>
      {models.length === 0 ? (
        <div className="model-hint">
          {emptyHint ?? "Chưa có mô hình nào đã cài."}
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
              <span className="nm">{m.name}</span>
              {m.sizeBytes != null && (
                <span className="sz mono">
                  {(m.sizeBytes / 1e9).toFixed(1)} GB
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
