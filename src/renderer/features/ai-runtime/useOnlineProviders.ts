import { useCallback, useEffect, useState } from "react";
import type {
  OnlineProviderId,
  OnlineState,
  RuntimeStatus,
} from "@shared/ipc/types";

// Báo cho PrivacyBadge biết trạng thái riêng tư có thể đã đổi (bật/tắt provider online) → badge tự nạp lại.
export const PRIVACY_CHANGED_EVENT = "iv:privacy-changed";
function notifyPrivacyChanged(): void {
  window.dispatchEvent(new Event(PRIVACY_CHANGED_EVENT));
}

// Hook quản lý khu vực AI online (031). Nạp OnlineState + các action (key/model/active/test). Action trả
// Promise để component xử lý confirm/lỗi. Key CHỈ đi tới main (không giữ ở state renderer).
export function useOnlineProviders() {
  const [state, setState] = useState<OnlineState | null>(null);

  const load = useCallback(() => {
    void window.api
      .aiGetOnlineState()
      .then(setState)
      .catch(() => {});
  }, []);

  useEffect(() => load(), [load]);

  const setKey = useCallback(
    (id: OnlineProviderId, apiKey: string): Promise<OnlineState> =>
      window.api.aiSetProviderKey({ id, apiKey }).then((s) => {
        setState(s);
        return s;
      }),
    [],
  );

  const deleteKey = useCallback(
    (id: OnlineProviderId): Promise<OnlineState> =>
      window.api.aiDeleteProviderKey(id).then((s) => {
        setState(s);
        notifyPrivacyChanged();
        return s;
      }),
    [],
  );

  const setModel = useCallback(
    (id: OnlineProviderId, model: string | null): Promise<OnlineState> =>
      window.api.aiSetProviderModel({ id, model }).then((s) => {
        setState(s);
        return s;
      }),
    [],
  );

  const setActive = useCallback(
    (id: OnlineProviderId | null): Promise<OnlineState> =>
      window.api.aiSetActiveProvider(id).then((s) => {
        setState(s);
        notifyPrivacyChanged();
        return s;
      }),
    [],
  );

  const test = useCallback(
    (id: OnlineProviderId): Promise<RuntimeStatus> =>
      window.api.aiTestProvider(id),
    [],
  );

  return { state, reload: load, setKey, deleteKey, setModel, setActive, test };
}
