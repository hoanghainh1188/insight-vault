import { describe, it, expect } from "vitest";
import { createVaultLock } from "../../src/main/services/vault-backup/vault-lock";
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
