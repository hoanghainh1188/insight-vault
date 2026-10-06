import { describe, it, expect } from "vitest";
import { CHANNELS, isWhitelisted } from "../../src/shared/ipc/channels";

describe("vault-backup (085) IPC whitelist", () => {
  it("8 kênh sao lưu/khôi phục đều whitelisted", () => {
    const expected = [
      "backup:getState",
      "backup:create",
      "backup:progress",
      "restore:pick",
      "restore:prepare",
      "restore:confirm",
      "restore:cancel",
      "app:getRestoreResult",
    ];
    for (const ch of expected) expect(isWhitelisted(ch)).toBe(true);
    expect(CHANNELS.backupCreate).toBe("backup:create");
    expect(CHANNELS.getRestoreResult).toBe("app:getRestoreResult");
  });

  it("không có kênh ghi/đọc file tuỳ ý theo path", () => {
    expect(isWhitelisted("backup:writeFile")).toBe(false);
    expect(isWhitelisted("restore:fromPath")).toBe(false);
  });
});
