import { ipcMain } from "electron";
import { CHANNELS, isWhitelisted } from "@shared/ipc/channels";
import type { DataDirInfo } from "@shared/ipc/types";
import { getPrivacyState } from "../services/app-shell/privacy-state";
import { buildAppInfo } from "../services/app-shell/app-info";
import {
  getOnboardingState,
  setOnboardingComplete,
  type StoreLike,
} from "../services/app-shell/onboarding";
import { logEvent } from "../logging";

interface RegisterDeps {
  store: StoreLike;
  version: string;
  dataDir: DataDirInfo;
}

/**
 * Đăng ký IPC handler CHỈ cho các kênh whitelisted (Constitution III, US2).
 * KHÔNG có handler catch-all: renderer gọi kênh ngoài danh sách ⇒ không có handler ⇒ Promise reject,
 * không side effect. `safeHandle` chặn cứng nếu ai đó lỡ đăng ký tên ngoài whitelist.
 */
export function registerIpc({ store, version, dataDir }: RegisterDeps): void {
  const safeHandle = (
    channel: string,
    fn: (...a: unknown[]) => unknown,
  ): void => {
    if (!isWhitelisted(channel)) {
      throw new Error(`IPC channel không nằm trong whitelist: ${channel}`);
    }
    ipcMain.handle(channel, () => fn());
  };

  safeHandle(CHANNELS.getDataDir, () => dataDir);
  safeHandle(CHANNELS.getPrivacyState, () => getPrivacyState());
  safeHandle(CHANNELS.getOnboardingState, () => getOnboardingState(store));
  safeHandle(CHANNELS.setOnboardingComplete, () =>
    setOnboardingComplete(store),
  );
  safeHandle(CHANNELS.getAppInfo, () => buildAppInfo(version));

  logEvent("ipc.registered", { channels: Object.values(CHANNELS).length });
}
