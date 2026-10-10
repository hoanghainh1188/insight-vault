import { useEffect, useRef, useState } from "react";
import type { StudioKind, StudioResult } from "@shared/ipc/types";
import { formatShortDateTime } from "@shared/i18n";
import { useLang, useT } from "../../shared/i18n/i18n-context";
import { announce } from "../../shared/a11y/announcer";
import { studioVersionDeletedMessage } from "../../shared/a11y/messages";

// 178 (FR-002, FR-004): bộ chọn phiên bản trên thẻ kết quả. Select có tên đọc (chỉ khi ≥ 2 bản) + nút xoá bản đang xem;
// xoá là MẤT dữ liệu ⇒ xác nhận tại chỗ (alertdialog, khuôn SourceItem — vừa cột hẹp). Sau xoá: báo trình đọc màn hình,
// focus về select (còn bản) hoặc để cột trả focus về nút loại (hết bản — onEmptied).

interface StudioVersionPickerProps {
  kind: StudioKind;
  /** Phiên bản của loại, mới nhất trước. */
  versions: readonly StudioResult[];
  currentId: string;
  onSelect: (id: string) => void;
  /** Xoá phiên bản; trả id phiên bản hiển thị tiếp theo (undefined ⇒ hết bản). */
  onDelete: (id: string) => Promise<string | undefined>;
  onEmptied?: () => void;
}

export function StudioVersionPicker({
  kind,
  versions,
  currentId,
  onSelect,
  onDelete,
  onEmptied,
}: StudioVersionPickerProps): JSX.Element {
  const t = useT();
  const lang = useLang();
  const kindLabel = t.t(`studio.kind.${kind}`);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Đích focus sau khi đóng xác nhận / xoá xong (áp sau khi React commit).
  const [focusTo, setFocusTo] = useState<"delete" | "select" | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const total = versions.length;

  useEffect(() => {
    if (!focusTo) return;
    setFocusTo(null);
    const el =
      focusTo === "select"
        ? (selectRef.current ?? deleteRef.current)
        : deleteRef.current;
    el?.focus();
  }, [focusTo, versions]);

  const cancelConfirm = (): void => {
    setConfirming(false);
    setFocusTo("delete");
  };

  const confirmDelete = async (): Promise<void> => {
    setBusy(true);
    setFailed(false);
    try {
      const next = await onDelete(currentId);
      announce(studioVersionDeletedMessage(kindLabel, t));
      setConfirming(false);
      if (next === undefined) onEmptied?.();
      else setFocusTo("select");
    } catch {
      // IPC lỗi ⇒ giữ hộp xác nhận để thử lại + báo lỗi tại chỗ (dữ liệu không đổi).
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="studio-versions" data-testid={`studio-versions-${kind}`}>
      <div className="studio-versions-row">
        {total >= 2 && (
          <select
            ref={selectRef}
            className="studio-version-select"
            value={currentId}
            aria-label={t.t("studio.versions.labelAria", { kind: kindLabel })}
            onChange={(e) => onSelect(e.target.value)}
            data-testid={`studio-version-select-${kind}`}
          >
            {versions.map((v, i) => (
              <option key={v.id} value={v.id}>
                {t.t("studio.versions.option", {
                  n: total - i,
                  total,
                  time: formatShortDateTime(v.createdAt, lang),
                })}
              </option>
            ))}
          </select>
        )}
        <button
          ref={deleteRef}
          type="button"
          className="studio-cardbtn studio-version-delete"
          aria-label={t.t("studio.versions.deleteAria", { kind: kindLabel })}
          title={t.t("studio.versions.delete")}
          onClick={() => setConfirming(true)}
          disabled={confirming}
          data-testid={`studio-version-delete-${kind}`}
        >
          {t.t("studio.versions.delete")}
        </button>
      </div>
      {confirming && (
        <div
          className="studio-version-confirm"
          role="alertdialog"
          aria-label={t.t("studio.versions.confirmLabel", { kind: kindLabel })}
          data-testid={`studio-version-confirm-${kind}`}
        >
          <p>{t.t("studio.versions.confirmBody")}</p>
          {failed && (
            <p
              className="studio-version-error"
              role="alert"
              data-testid={`studio-version-error-${kind}`}
            >
              {t.t("studio.versions.deleteFailed")}
            </p>
          )}
          <div className="studio-version-confirm-actions">
            <button
              type="button"
              className="studio-cardbtn"
              onClick={cancelConfirm}
              data-testid={`studio-version-confirm-cancel-${kind}`}
            >
              {t.t("common.cancel")}
            </button>
            <button
              type="button"
              className="studio-cardbtn studio-version-confirm-ok"
              onClick={() => void confirmDelete()}
              disabled={busy}
              autoFocus
              data-testid={`studio-version-confirm-ok-${kind}`}
            >
              {t.t("common.delete")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
