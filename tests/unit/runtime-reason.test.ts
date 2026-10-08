import { describe, it, expect } from "vitest";
import { runtimeReasonText } from "../../src/renderer/features/ai-runtime/runtime-reason";
import { encodeUserError } from "../../src/shared/codes/user-error";
import { tagOnlineError } from "../../src/shared/online-error-tag";
import { trEn, trVi } from "./helpers/t-vi";

// 123 (FR-008): lý do runtime theo mã ⇒ câu theo ngôn ngữ hiện tại.

describe("runtimeReasonText", () => {
  it("không mã ⇒ null", () => {
    expect(runtimeReasonText({}, trEn)).toBeNull();
  });
  it("mã + tham số", () => {
    expect(runtimeReasonText({ reasonCode: "ollamaUnreachable" }, trVi)).toBe(
      "Không kết nối được Ollama (kiểm tra Ollama đã cài và đang chạy).",
    );
    expect(
      runtimeReasonText(
        { reasonCode: "modelsMissing", reasonParams: { models: "a, b" } },
        trEn,
      ),
    ).toBe("The selected model isn't installed on this computer: a, b.");
    expect(
      runtimeReasonText(
        { reasonCode: "apiKeyMissing", reasonParams: { provider: "OpenAI" } },
        trEn,
      ),
    ).toBe("OpenAI: no API key entered.");
  });
  it("connectionFailed có lỗi gốc mang thẻ ⇒ dịch lỗi gốc; không thẻ ⇒ câu chung theo provider", () => {
    expect(
      runtimeReasonText(
        {
          reasonCode: "connectionFailed",
          reasonParams: { provider: "Google (Gemini)" },
          reasonError: tagOnlineError("Google (Gemini): x", "auth"),
        },
        trEn,
      ),
    ).toBe("Google (Gemini): The API key is invalid or has expired.");
    expect(
      runtimeReasonText(
        {
          reasonCode: "connectionFailed",
          reasonParams: { provider: "OpenAI" },
          reasonError: "boom",
        },
        trEn,
      ),
    ).toBe("OpenAI: connection test failed.");
    expect(
      runtimeReasonText(
        {
          reasonCode: "connectionFailed",
          reasonParams: { provider: "OpenAI" },
          reasonError: encodeUserError("modelNotSelected", {
            provider: "OpenAI",
          }),
        },
        trVi,
      ),
    ).toBe("OpenAI: chưa chọn mô hình.");
  });
});
