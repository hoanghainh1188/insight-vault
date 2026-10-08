import { describe, it, expect } from "vitest";
import {
  describeError,
  describeIpcError,
} from "../../src/renderer/shared/i18n/describe-error";
import { encodeUserError } from "../../src/shared/codes/user-error";
import {
  parseIpcError,
  tagOnlineError,
} from "../../src/shared/online-error-tag";
import { trEn, trVi } from "./helpers/t-vi";

// 123 (FR-008, contracts/codes.md §2): lỗi IPC ⇒ câu theo ngôn ngữ hiện tại; không bao giờ hiện message thô không thẻ.

const PFX = "Error invoking remote method 'x': Error: ";

describe("describeIpcError", () => {
  it("mã UserFacingError ⇒ errors.<code> + tham số", () => {
    const p = parseIpcError(
      PFX + encodeUserError("notebookNameTooLong", { max: 100 }),
    );
    expect(describeIpcError(p, trEn)).toBe(
      "Notebook name can be at most 100 characters.",
    );
    expect(describeIpcError(p, trVi)).toBe("Tên notebook tối đa 100 ký tự.");
  });

  it("lỗi online ⇒ online.<kind>, có tiền tố nhà cung cấp nếu có", () => {
    const p = parseIpcError(
      PFX +
        tagOnlineError(
          "Claude (Anthropic): Khóa API không hợp lệ hoặc đã hết hạn.",
          "auth",
        ),
    );
    expect(describeIpcError(p, trEn)).toBe(
      "Claude (Anthropic): The API key is invalid or has expired.",
    );
    const noProvider = parseIpcError(PFX + tagOnlineError("x", "network"));
    expect(describeIpcError(noProvider, trEn)).toBe(
      "Couldn't reach the online AI server (check your network).",
    );
  });

  it("lỗi online kèm mã (chưa nhập khoá) ⇒ ưu tiên mã", () => {
    const p = parseIpcError(
      PFX +
        tagOnlineError(
          encodeUserError("apiKeyMissing", { provider: "OpenAI" }),
          "auth",
        ),
    );
    expect(p.code).toBe("apiKeyMissing");
    expect(describeIpcError(p, trEn)).toBe("OpenAI: no API key entered.");
  });

  it("không thẻ ⇒ errors.unexpected", () => {
    expect(describeIpcError(parseIpcError(PFX + "ENOENT: x"), trEn)).toBe(
      "Something went wrong. Please try again.",
    );
  });
});

describe("describeError (unknown)", () => {
  it("Error / chuỗi / khác ⇒ qua parseIpcError", () => {
    expect(
      describeError(new Error(PFX + encodeUserError("vaultLocked")), trVi),
    ).toBe("Đang sao lưu/khôi phục — thử lại sau giây lát.");
    expect(describeError("boom", trEn)).toBe(
      "Something went wrong. Please try again.",
    );
    expect(describeError(undefined, trEn)).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
