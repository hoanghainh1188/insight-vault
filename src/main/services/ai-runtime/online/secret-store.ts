import type { OnlineProviderId } from "@shared/ipc/types";

// Kho bí mật cho API key provider online (031, Constitution III). Bọc keytar (OS keychain / Credential
// Manager) qua interface inject được → unit-test bằng fake, không cần keychain thật. KHÔNG log key.
// service cố định "InsightVault", account = provider id.

export const SECRET_SERVICE = "InsightVault";

/** Bề mặt tối thiểu của keytar mà store cần (để inject fake khi test). */
export interface KeytarLike {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(
    service: string,
    account: string,
    password: string,
  ): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
}

export interface SecretStore {
  getKey(id: OnlineProviderId): Promise<string | null>;
  setKey(id: OnlineProviderId, key: string): Promise<void>;
  deleteKey(id: OnlineProviderId): Promise<void>;
  hasKey(id: OnlineProviderId): Promise<boolean>;
}

export function createSecretStore(
  keytar: KeytarLike,
  service: string = SECRET_SERVICE,
): SecretStore {
  return {
    async getKey(id) {
      try {
        return await keytar.getPassword(service, id);
      } catch {
        return null; // keychain lỗi/không có → coi như chưa có key (không ném xuyên IPC).
      }
    },
    async setKey(id, key) {
      await keytar.setPassword(service, id, key);
    },
    async deleteKey(id) {
      try {
        await keytar.deletePassword(service, id);
      } catch {
        // xoá key không tồn tại / keychain lỗi → bỏ qua (idempotent).
      }
    },
    async hasKey(id) {
      const v = await this.getKey(id);
      return typeof v === "string" && v.length > 0;
    },
  };
}
