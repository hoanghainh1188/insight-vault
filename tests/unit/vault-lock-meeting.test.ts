import { describe, it, expect } from "vitest";
import {
  createVaultLock,
  isMaintenanceBusy,
} from "../../src/main/services/vault-backup/vault-lock";

// 186 PR C1 (T108/T116, D8): bảo trì vector không bị chặn bởi phiên ghi đang chạy; vẫn bị chặn bởi hoàn tất, sao lưu, reindex.

function setup(o: {
  processing?: string[];
  recording?: string | null;
  reindexing?: boolean;
  queued?: number;
}) {
  const processing = o.processing ?? [];
  const lock = createVaultLock({
    hasActiveSources: () => processing.length > 0 || (o.queued ?? 0) > 0,
    isReindexing: () => o.reindexing ?? false,
  });
  const busy = () =>
    isMaintenanceBusy(lock, {
      isReindexing: () => o.reindexing ?? false,
      processingSourceIds: () => processing,
      queuedCount: () => o.queued ?? 0,
      isReprocessing: () => false,
      recordingSourceId: () => o.recording ?? null,
    });
  return { lock, busy };
}

describe("isMaintenanceBusy", () => {
  it("chỉ có cuộc họp đang ghi ⇒ bảo trì vẫn chạy; sao lưu thì bận", () => {
    const t = setup({ processing: ["m1"], recording: "m1" });
    expect(t.busy()).toBe(false);
    expect(t.lock.getState()).toEqual({ busy: true, reason: "processing" });
  });

  it("cuộc họp đang hoàn tất (không còn ghi) ⇒ bận", () => {
    expect(setup({ processing: ["m1"], recording: null }).busy()).toBe(true);
  });

  it("nguồn khác đang xử lý / có hàng chờ / reindex ⇒ bận", () => {
    expect(setup({ processing: ["m1", "pdf"], recording: "m1" }).busy()).toBe(true);
    expect(setup({ queued: 1 }).busy()).toBe(true);
    expect(setup({ reindexing: true }).busy()).toBe(true);
  });

  it("đang sao lưu ⇒ bận", () => {
    const t = setup({});
    t.lock.beginOperation("backup");
    expect(t.busy()).toBe(true);
  });
});
