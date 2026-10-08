import { describe, it, expect } from "vitest";
import {
  UserFacingError,
  encodeUserError,
  USER_ERROR_CODES,
} from "../../src/shared/codes/user-error";
import {
  parseIpcError,
  tagOnlineError,
} from "../../src/shared/online-error-tag";

// 123 (FR-008, contracts/codes.md §2): lỗi người-dùng-thấy đi qua IPC dưới dạng MÃ + tham số, renderer dịch.

const ELECTRON = "Error invoking remote method 'notebook:create': Error: ";

describe("UserFacingError / encodeUserError", () => {
  it("giữ code + params; message chỉ ASCII", () => {
    const e = new UserFacingError("notebookNameTooLong", { max: 100 });
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe("notebookNameTooLong");
    expect(e.params).toEqual({ max: 100 });
    expect(/^[\x20-\x7e]*$/.test(e.message)).toBe(true);
    expect(e.message).toBe(
      encodeUserError("notebookNameTooLong", { max: 100 }),
    );
  });

  it("tham số có chữ Việt vẫn mã hoá ASCII và giải mã đúng", () => {
    const msg = encodeUserError("unsupportedFormat", { ext: "tệp" });
    expect(/^[\x20-\x7e]*$/.test(msg)).toBe(true);
    expect(parseIpcError(ELECTRON + msg)).toMatchObject({
      code: "unsupportedFormat",
      params: { ext: "tệp" },
    });
  });

  it("danh sách mã không trùng", () => {
    expect(new Set(USER_ERROR_CODES).size).toBe(USER_ERROR_CODES.length);
  });
});

describe("parseIpcError (mở rộng)", () => {
  it("bỏ tiền tố Electron, lấy code + params", () => {
    const p = parseIpcError(
      ELECTRON + encodeUserError("questionTooLong", { max: 2000 }),
    );
    expect(p.code).toBe("questionTooLong");
    expect(p.params).toEqual({ max: 2000 });
    expect(p.onlineKind).toBeNull();
  });

  it("không params ⇒ code, params undefined", () => {
    const p = parseIpcError(ELECTRON + encodeUserError("vaultLocked"));
    expect(p.code).toBe("vaultLocked");
    expect(p.params).toBeUndefined();
  });

  it("params hỏng / sai kiểu / quá dài ⇒ bỏ params, giữ code", () => {
    const broken = parseIpcError("vaultLocked [[err:vaultLocked|%%%]]");
    expect(broken.code).toBe("vaultLocked");
    expect(broken.params).toBeUndefined();
    const bad = Buffer.from(JSON.stringify({ a: { nested: 1 } })).toString(
      "base64url",
    );
    expect(parseIpcError(`x [[err:ollamaHttp|${bad}]]`).params).toBeUndefined();
    const long = Buffer.from(JSON.stringify({ a: "x".repeat(201) })).toString(
      "base64url",
    );
    expect(
      parseIpcError(`x [[err:ollamaHttp|${long}]]`).params,
    ).toBeUndefined();
  });

  it("mã lạ ⇒ không code; message là phần trước thẻ", () => {
    const p = parseIpcError("boom [[err:notACode]]");
    expect(p.code).toBeUndefined();
    expect(p.message).toBe("boom");
  });

  it("thẻ online 098 vẫn ra onlineKind + tách provider từ tiền tố", () => {
    const p = parseIpcError(
      ELECTRON +
        tagOnlineError(
          "Claude (Anthropic): Khóa API không hợp lệ hoặc đã hết hạn.",
          "auth",
        ),
    );
    expect(p.onlineKind).toBe("auth");
    expect(p.provider).toBe("Claude (Anthropic)");
    expect(p.code).toBeUndefined();
  });

  it("lỗi thường không thẻ ⇒ chỉ message", () => {
    expect(parseIpcError(ELECTRON + "ENOENT: no such file")).toEqual({
      message: "ENOENT: no such file",
      onlineKind: null,
    });
  });
});

describe("123 security: errorTagsOnly + giới hạn độ dài", () => {
  it("giữ thẻ + nhà cung cấp, bỏ văn bản thô", async () => {
    const { errorTagsOnly } = await import("../../src/shared/online-error-tag");
    const raw = tagOnlineError(
      "OpenAI: 401 https://api.example/v1?key=secret body={...}",
      "auth",
    );
    const t = errorTagsOnly(raw)!;
    expect(t).not.toContain("secret");
    expect(parseIpcError(t)).toMatchObject({
      onlineKind: "auth",
      provider: "OpenAI",
    });
    const enc = encodeUserError("modelNotSelected", { provider: "OpenAI" });
    expect(parseIpcError(errorTagsOnly(enc)!)).toMatchObject({
      code: "modelNotSelected",
      params: { provider: "OpenAI" },
    });
    expect(errorTagsOnly("plain failure without tag")).toBeUndefined();
  });

  it("chuỗi rất dài không làm treo, vẫn tách được thẻ cuối", () => {
    const long = " ".repeat(100_000) + "x [[err:vaultLocked]]";
    const t0 = Date.now();
    expect(parseIpcError(long).code).toBe("vaultLocked");
    expect(Date.now() - t0).toBeLessThan(200);
  });
});

describe("123 review: tham số dài bị cắt khi mã hoá (không mất khi giải mã)", () => {
  it("chuỗi > 200 ký tự ⇒ cắt còn 200", () => {
    const p = parseIpcError(
      encodeUserError("unsupportedFormat", { ext: "x".repeat(500) }),
    );
    expect(p.params?.ext).toHaveLength(200);
  });
});
