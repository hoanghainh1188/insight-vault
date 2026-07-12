import { useState } from "react";
import type { OnlineProviderId, OnlineProviderView } from "@shared/ipc/types";
import { useOnlineProviders } from "./useOnlineProviders";

// Khu vực "AI online (tùy chọn)" trong Cài đặt (031, prototype #s5). 3 hàng provider: trạng thái khóa (che),
// nhập/xoá khóa, chọn model (preset + "Khác"), bật/tắt độc quyền (confirm 1 lần khi bật), kiểm tra kết nối.
// Key CHỈ đi tới main (keytar) — không giữ ở state renderer ngoài ô nhập tạm.

const CUSTOM = "__custom__";

export function SettingsAiOnlineSection(): JSX.Element {
  const { state, setKey, deleteKey, setModel, setActive, test } =
    useOnlineProviders();
  const [confirmId, setConfirmId] = useState<OnlineProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onError = (e: unknown): void =>
    setError(e instanceof Error ? e.message : "Thao tác thất bại.");

  const confirmProvider = state?.providers.find((p) => p.id === confirmId);

  return (
    <section
      className="settings-ai settings-ai-online"
      data-testid="settings-ai-online"
    >
      <div className="settings-ai-head">
        <h3>AI online (tùy chọn)</h3>
        {state?.activeOnlineId && (
          <span className="tag warn" data-testid="online-active-tag">
            Đang gửi dữ liệu ra ngoài
          </span>
        )}
      </div>
      <p className="ai-note" data-testid="online-egress-note">
        Khi bật, câu hỏi và đoạn nguồn liên quan sẽ được gửi tới máy chủ nhà
        cung cấp. Dùng khóa API của chính bạn. Mặc định app chạy cục bộ, không
        gửi gì ra ngoài.
      </p>

      {error && (
        <div
          className="ai-note ai-error"
          data-testid="online-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {(state?.providers ?? []).map((p) => (
        <ProviderRow
          key={p.id}
          view={p}
          onSaveKey={(k) => setKey(p.id, k).catch(onError)}
          onDeleteKey={() => deleteKey(p.id).catch(onError)}
          onSetModel={(m) => setModel(p.id, m).catch(onError)}
          onRequestActivate={() => {
            setError(null);
            setConfirmId(p.id);
          }}
          onDeactivate={() => setActive(null).catch(onError)}
          onTest={() => test(p.id)}
        />
      ))}

      {confirmProvider && (
        <div
          className="online-confirm"
          role="alertdialog"
          data-testid="online-confirm"
        >
          <p>
            Bật <strong>{confirmProvider.label}</strong>? Câu hỏi và đoạn nguồn
            liên quan sẽ được gửi tới máy chủ của nhà cung cấp này.
          </p>
          <div className="online-confirm-actions">
            <button
              type="button"
              className="btn-sm"
              onClick={() => setConfirmId(null)}
              data-testid="online-confirm-cancel"
            >
              Huỷ
            </button>
            <button
              type="button"
              className="btn-sm btn-primary"
              data-testid="online-confirm-ok"
              onClick={() => {
                const id = confirmProvider.id;
                setConfirmId(null);
                setActive(id).catch(onError);
              }}
            >
              Bật
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ProviderRow({
  view,
  onSaveKey,
  onDeleteKey,
  onSetModel,
  onRequestActivate,
  onDeactivate,
  onTest,
}: {
  view: OnlineProviderView;
  onSaveKey: (key: string) => void;
  onDeleteKey: () => void;
  onSetModel: (model: string | null) => void;
  onRequestActivate: () => void;
  onDeactivate: () => void;
  onTest: () => Promise<{ reachable: boolean; reason: string | null }>;
}): JSX.Element {
  const [draftKey, setDraftKey] = useState("");
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const isCustom = view.model !== null && !view.presets.includes(view.model);
  const [customMode, setCustomMode] = useState(isCustom);

  return (
    <div className="online-row" data-testid={`online-row-${view.id}`}>
      <div className="online-row-head">
        <strong>{view.label}</strong>
        <span
          className={`tag ${view.hasKey ? "ok" : "warn"}`}
          data-testid={`online-key-status-${view.id}`}
        >
          {view.hasKey ? "Đã lưu khóa ••••" : "Chưa nhập khóa API"}
        </span>
        <label className="online-toggle">
          <input
            type="checkbox"
            checked={view.active}
            disabled={!view.hasKey && !view.active}
            data-testid={`online-toggle-${view.id}`}
            onChange={(e) =>
              e.target.checked ? onRequestActivate() : onDeactivate()
            }
          />
          <span>Dùng</span>
        </label>
      </div>

      <div className="online-row-body">
        <div className="online-key-input">
          <input
            type="password"
            placeholder={view.hasKey ? "Nhập khóa mới để thay" : "Dán API key"}
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            data-testid={`online-key-input-${view.id}`}
          />
          <button
            type="button"
            className="btn-sm"
            disabled={draftKey.trim() === ""}
            data-testid={`online-key-save-${view.id}`}
            onClick={() => {
              onSaveKey(draftKey.trim());
              setDraftKey("");
            }}
          >
            Lưu
          </button>
          {view.hasKey && (
            <button
              type="button"
              className="btn-sm"
              data-testid={`online-key-delete-${view.id}`}
              onClick={onDeleteKey}
            >
              Xoá
            </button>
          )}
        </div>

        <div className="online-model">
          <select
            value={customMode ? CUSTOM : (view.model ?? "")}
            data-testid={`online-model-${view.id}`}
            onChange={(e) => {
              if (e.target.value === CUSTOM) {
                setCustomMode(true);
              } else {
                setCustomMode(false);
                onSetModel(e.target.value || null);
              }
            }}
          >
            <option value="">— Chọn mô hình —</option>
            {view.presets.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value={CUSTOM}>Khác (nhập tay)…</option>
          </select>
          {customMode && (
            <input
              type="text"
              placeholder="Tên mô hình"
              defaultValue={view.model ?? ""}
              data-testid={`online-model-custom-${view.id}`}
              onBlur={(e) => onSetModel(e.target.value.trim() || null)}
            />
          )}
          <button
            type="button"
            className="btn-sm"
            data-testid={`online-test-${view.id}`}
            onClick={() => {
              setTestMsg("Đang kiểm tra…");
              onTest().then((s) =>
                setTestMsg(
                  s.reachable ? "Kết nối OK ✓" : (s.reason ?? "Lỗi kết nối"),
                ),
              );
            }}
          >
            Kiểm tra kết nối
          </button>
        </div>
        {testMsg && (
          <span
            className="online-test-msg"
            data-testid={`online-test-msg-${view.id}`}
          >
            {testMsg}
          </span>
        )}
      </div>
    </div>
  );
}
