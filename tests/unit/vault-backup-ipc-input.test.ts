import { describe, it, expect } from "vitest";
import {
  parseBackupCreateInput,
  parseRestoreTokenInput,
} from "../../src/main/services/vault-backup/ipc-input";

const TOKEN = "3f2c1a8e-9b4d-4c6e-8f00-1234567890ab";

describe("vault-backup IPC input (boundary)", () => {
  it("backup:create — rỗng/không mật khẩu/mật khẩu string; sai hình ⇒ null", () => {
    expect(parseBackupCreateInput(undefined)).toEqual({});
    expect(parseBackupCreateInput({})).toEqual({});
    expect(parseBackupCreateInput({ password: "12345678" })).toEqual({
      password: "12345678",
    });
    expect(parseBackupCreateInput({ password: 123 })).toBeNull();
    expect(parseBackupCreateInput({ password: "x".repeat(1025) })).toBeNull();
    expect(parseBackupCreateInput("chuỗi")).toBeNull();
    // KHÔNG nhận path từ renderer — field lạ bị bỏ qua
    expect(parseBackupCreateInput({ path: "/etc/passwd" })).toEqual({});
  });

  it("restore:* — token UUID bắt buộc, password tuỳ chọn", () => {
    expect(parseRestoreTokenInput({ token: TOKEN })).toEqual({ token: TOKEN });
    expect(
      parseRestoreTokenInput({ token: TOKEN, password: "mat-khau-1" }),
    ).toEqual({ token: TOKEN, password: "mat-khau-1" });
    expect(parseRestoreTokenInput({ token: "../../x" })).toBeNull();
    expect(parseRestoreTokenInput({})).toBeNull();
    expect(parseRestoreTokenInput(null)).toBeNull();
    expect(parseRestoreTokenInput({ token: TOKEN, password: 5 })).toBeNull();
  });
});
