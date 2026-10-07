import { describe, it, expect } from "vitest";
import {
  parseIpcError,
  tagOnlineError,
} from "../../src/shared/online-error-tag";

// 098 — lỗi provider online đi qua IPC: main gắn thẻ loại lỗi vào message, renderer tách ra để biết có hiện nút
// "Trả lời bằng AI cục bộ" không; người dùng không thấy thẻ hay tiền tố kỹ thuật của Electron.

describe("tagOnlineError / parseIpcError", () => {
  it("lỗi online qua IPC ⇒ online=true, message sạch (bỏ tiền tố Electron + thẻ)", () => {
    const tagged = tagOnlineError(
      "Claude: Nhà cung cấp đang giới hạn tốc độ.",
      "rate-limit",
    );
    const raw = `Error invoking remote method 'rag:askStream': Error: ${tagged}`;
    expect(parseIpcError(raw)).toEqual({
      message: "Claude: Nhà cung cấp đang giới hạn tốc độ.",
      onlineKind: "rate-limit",
    });
  });

  it("lỗi thường ⇒ onlineKind=null, vẫn bỏ tiền tố Electron", () => {
    expect(
      parseIpcError(
        "Error invoking remote method 'studio:generate': Error: Runtime AI cục bộ chưa sẵn sàng.",
      ),
    ).toEqual({
      message: "Runtime AI cục bộ chưa sẵn sàng.",
      onlineKind: null,
    });
  });

  it("chuỗi không có tiền tố/thẻ ⇒ giữ nguyên", () => {
    expect(parseIpcError("Câu hỏi trống.")).toEqual({
      message: "Câu hỏi trống.",
      onlineKind: null,
    });
  });

  it("thẻ lạ (không thuộc danh sách loại) ⇒ không coi là lỗi online", () => {
    expect(parseIpcError("x [[online:hack]]").onlineKind).toBeNull();
  });

  it("tên lỗi tuỳ biến trong tiền tố cũng được bỏ", () => {
    expect(
      parseIpcError("Error invoking remote method 'rag:ask': TypeError: hỏng")
        .message,
    ).toBe("hỏng");
  });
});
