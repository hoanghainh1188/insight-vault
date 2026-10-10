import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { Source } from "@shared/ipc/types";
import { STUDIO_MAX_SOURCE_IDS } from "@shared/studio-scope";
import { useT } from "../../shared/i18n/i18n-context";

// 178 (PR 4, FR-030, research R6): bộ chọn phạm vi nhiều nguồn — nút DISCLOSURE (không phải menu ARIA) mở danh sách checkbox
// có nhãn ngay trong cột. `selected` rỗng = mọi nguồn ready. Esc đóng + trả focus về nút. Chỉ hiện khi > 1 nguồn ready.
// Main vẫn kiểm lại (thuộc notebook, ready, ≤ 50) — đây chỉ là tiện lợi giao diện.

type ScopeSource = Pick<Source, "id" | "title">;

interface StudioScopePickerProps {
  /** Nguồn ready của notebook (thứ tự hiển thị). */
  sources: readonly ScopeSource[];
  /** Id đang chọn; rỗng = tất cả nguồn. */
  selected: readonly string[];
  onChange: (ids: readonly string[]) => void;
  disabled?: boolean;
}

export function StudioScopePicker({
  sources,
  selected,
  onChange,
  disabled = false,
}: StudioScopePickerProps): JSX.Element | null {
  const t = useT();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const limitId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  if (sources.length <= 1) return null;

  const chosen = new Set(selected);
  const atLimit = chosen.size >= STUDIO_MAX_SOURCE_IDS;
  const label =
    chosen.size === 0
      ? t.t("studio.scope.toggleAll")
      : t.plural("studio.scope.toggleCount", chosen.size);

  // Giữ thứ tự nguồn (không theo thứ tự bấm) — mảng MỚI, không mutate `selected`.
  const toggleSource = (id: string): void => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(sources.filter((s) => next.has(s.id)).map((s) => s.id));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    setOpen(false);
    toggleRef.current?.focus();
  };

  return (
    <div className="studio-scope">
      <button
        ref={toggleRef}
        type="button"
        className="studio-scope-toggle"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        data-testid="studio-scope-toggle"
      >
        {label}
      </button>
      {open && (
        <div
          id={listId}
          role="group"
          aria-label={t.t("studio.scope.listLabel")}
          className="studio-scope-list"
          onKeyDown={onKeyDown}
          data-testid="studio-scope-list"
        >
          <button
            type="button"
            className="studio-scope-all"
            aria-pressed={chosen.size === 0}
            onClick={() => onChange([])}
            data-testid="studio-scope-all"
          >
            {t.t("studio.scope.all")}
          </button>
          <ul className="studio-scope-items">
            {sources.map((s) => {
              const checked = chosen.has(s.id);
              return (
                <li key={s.id}>
                  <label className="studio-scope-item">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && atLimit}
                      aria-describedby={atLimit ? limitId : undefined}
                      onChange={() => toggleSource(s.id)}
                    />
                    <span className="studio-scope-title">{s.title}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {atLimit && (
            <p id={limitId} className="studio-scope-limit">
              {t.t("studio.scope.limit", { max: STUDIO_MAX_SOURCE_IDS })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
