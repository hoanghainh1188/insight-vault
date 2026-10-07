import { describe, it, expect } from "vitest";
import {
  createVaultLock,
  isVaultBusy,
} from "../../src/main/services/vault-backup/vault-lock";
import { VaultBackupFailure } from "../../src/main/services/vault-backup/errors";

function make(active = false, reindexing = false) {
  const flags = { active, reindexing };
  const lock = createVaultLock({
    hasActiveSources: () => flags.active,
    isReindexing: () => flags.reindexing,
  });
  return { lock, flags };
}

describe("vault-backup lock + busy", () => {
  it("rảnh ⇒ không busy", () => {
    expect(make().lock.getState()).toEqual({ busy: false, reason: null });
  });

  it("có nguồn đang xử lý ⇒ processing; đang reindex ⇒ reindexing", () => {
    expect(make(true).lock.getState()).toEqual({
      busy: true,
      reason: "processing",
    });
    expect(make(false, true).lock.getState()).toEqual({
      busy: true,
      reason: "reindexing",
    });
  });

  it("beginOperation khi busy ⇒ ném busy; khi rảnh ⇒ chặn thao tác thứ 2", () => {
    const { lock, flags } = make(true);
    expect(() => lock.beginOperation("backup")).toThrow(VaultBackupFailure);
    flags.active = false;
    lock.beginOperation("backup");
    expect(lock.getState()).toEqual({ busy: true, reason: "operation" });
    expect(() => lock.beginOperation("restore")).toThrow(VaultBackupFailure);
    lock.endOperation();
    expect(lock.getState().busy).toBe(false);
  });

  it("withLock giữ khoá trong lúc chạy và nhả kể cả khi lỗi", async () => {
    const { lock } = make();
    expect(lock.isLocked()).toBe(false);
    await lock.withLock(async () => {
      expect(lock.isLocked()).toBe(true);
    });
    expect(lock.isLocked()).toBe(false);
    await expect(
      lock.withLock(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(lock.isLocked()).toBe(false);
  });

  it("lockUntilExit khoá vĩnh viễn (sau xác nhận khôi phục)", async () => {
    const { lock } = make();
    lock.lockUntilExit();
    await lock.withLock(async () => undefined);
    expect(lock.isLocked()).toBe(true);
  });
});

// 116 (contracts C5): định nghĩa "bận" dùng chung cho bảo trì kho vector.
describe("isVaultBusy", () => {
  it("rảnh ⇒ false", () => {
    expect(isVaultBusy(make().lock)).toBe(false);
  });

  it("nguồn đang xử lý / reindex ⇒ true", () => {
    expect(isVaultBusy(make(true).lock)).toBe(true);
    expect(isVaultBusy(make(false, true).lock)).toBe(true);
  });

  it("đang có thao tác sao lưu/khôi phục ⇒ true; kết thúc ⇒ false", () => {
    const { lock } = make();
    lock.beginOperation("backup");
    expect(isVaultBusy(lock)).toBe(true);
    lock.endOperation();
    expect(isVaultBusy(lock)).toBe(false);
  });

  it("đang giữ khoá chụp (withLock) ⇒ true", async () => {
    const { lock } = make();
    let seen = false;
    await lock.withLock(async () => {
      seen = isVaultBusy(lock);
    });
    expect(seen).toBe(true);
    expect(isVaultBusy(lock)).toBe(false);
  });

  it("khoá vĩnh viễn sau xác nhận khôi phục ⇒ true", () => {
    const { lock } = make();
    lock.lockUntilExit();
    expect(isVaultBusy(lock)).toBe(true);
  });
});
