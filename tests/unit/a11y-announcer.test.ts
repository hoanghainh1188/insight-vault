import { describe, it, expect, vi } from "vitest";
import { createAnnouncer } from "../../src/renderer/shared/a11y/announcer";
import {
  chatCancelledMessage,
  chatStartedMessage,
  chatDoneMessage,
  progressValueText,
  reindexMessage,
  sourceStatusMessage,
  studioMessage,
} from "../../src/renderer/shared/a11y/messages";
import { trEn } from "./helpers/t-vi";

// 091 — thông báo trình đọc màn hình: chỉ MỐC trạng thái (không từng token / từng %), tiếng Việt.

describe("createAnnouncer", () => {
  it("phát thông báo tới mọi subscriber, mặc định polite, id tăng dần", () => {
    const a = createAnnouncer();
    const got: unknown[] = [];
    a.subscribe((x) => got.push(x));
    a.announce("Một");
    a.announce("Hai", "assertive");
    expect(got).toEqual([
      { id: 1, message: "Một", politeness: "polite" },
      { id: 2, message: "Hai", politeness: "assertive" },
    ]);
  });

  it("bỏ qua chuỗi rỗng/khoảng trắng; huỷ đăng ký thì không nhận nữa", () => {
    const a = createAnnouncer();
    const fn = vi.fn();
    const off = a.subscribe(fn);
    a.announce("   ");
    off();
    a.announce("Sau");
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("chatDoneMessage", () => {
  it("có trích dẫn ⇒ nêu số trích dẫn", () => {
    expect(chatDoneMessage({ citationCount: 3 })).toBe(
      "Đã có câu trả lời, 3 trích dẫn.",
    );
  });
  it("không trích dẫn ⇒ chỉ báo đã có câu trả lời", () => {
    expect(chatDoneMessage({ citationCount: 0 })).toBe("Đã có câu trả lời.");
  });
  it("không tìm thấy trong nguồn", () => {
    expect(chatDoneMessage({ citationCount: 0, notFound: true })).toBe(
      "Không tìm thấy thông tin trong nguồn.",
    );
  });
  it("người dùng bấm Dừng", () => {
    expect(chatDoneMessage({ citationCount: 2, stopped: true })).toBe(
      "Đã dừng. Giữ phần câu trả lời đã nhận.",
    );
  });
  it("câu bắt đầu / huỷ do chuyển notebook", () => {
    expect(chatStartedMessage()).toBe("Đang soạn câu trả lời…");
    expect(chatCancelledMessage()).toBe(
      "Đã huỷ câu trả lời đang soạn vì chuyển notebook.",
    );
  });
});

describe("sourceStatusMessage", () => {
  const ev = (status: string, errorLabel?: string) =>
    ({ status, errorLabel }) as Parameters<typeof sourceStatusMessage>[1];

  it("chỉ báo khi trạng thái ĐỔI (bước/% thay đổi không báo)", () => {
    expect(sourceStatusMessage("processing", ev("processing"), "a.pdf")).toBe(
      null,
    );
  });
  it("bắt đầu xử lý", () => {
    expect(sourceStatusMessage("queued", ev("processing"), "a.pdf")).toBe(
      "Đang xử lý nguồn “a.pdf”.",
    );
    expect(sourceStatusMessage(undefined, ev("processing"), "a.pdf")).toBe(
      "Đang xử lý nguồn “a.pdf”.",
    );
  });
  it("sẵn sàng / chờ nhúng / lỗi", () => {
    expect(sourceStatusMessage("processing", ev("ready"), "a.pdf")).toBe(
      "Nguồn “a.pdf” đã sẵn sàng.",
    );
    expect(
      sourceStatusMessage("processing", ev("awaiting_embedding"), "a.pdf"),
    ).toBe("Nguồn “a.pdf” đang chờ nhúng.");
    expect(
      sourceStatusMessage("processing", ev("error", "Lỗi nhúng"), "a.pdf"),
    ).toBe("Nguồn “a.pdf” lỗi: Lỗi nhúng.");
    // 123: mã nhãn lỗi ⇒ dịch; nhãn lạ ⇒ "Lỗi không xác định" (không hiện văn bản thô lạ)
    expect(
      sourceStatusMessage("processing", ev("error", "embed"), "a.pdf"),
    ).toBe("Nguồn “a.pdf” lỗi: Lỗi nhúng.");
    expect(
      sourceStatusMessage("processing", ev("error", "Tệp hỏng"), "a.pdf"),
    ).toBe("Nguồn “a.pdf” lỗi: Lỗi không xác định.");
    expect(sourceStatusMessage("processing", ev("error"), "a.pdf")).toBe(
      "Nguồn “a.pdf” lỗi: không xử lý được.",
    );
  });
  it("chưa biết tên nguồn ⇒ câu không kèm tên", () => {
    expect(sourceStatusMessage(undefined, ev("ready"), undefined)).toBe(
      "Nguồn đã sẵn sàng.",
    );
    expect(sourceStatusMessage(undefined, ev("processing"), undefined)).toBe(
      "Đang xử lý nguồn.",
    );
  });

  it("123: dịch theo translator truyền vào (English)", () => {
    expect(
      sourceStatusMessage("processing", ev("error", "embed"), "a.pdf", trEn),
    ).toBe("Source “a.pdf” failed: Embedding failed.");
    expect(chatDoneMessage({ citationCount: 1 }, trEn)).toBe(
      "The answer is ready, 1 citation.",
    );
    expect(chatDoneMessage({ citationCount: 2 }, trEn)).toBe(
      "The answer is ready, 2 citations.",
    );
  });

  it("vào hàng đợi thì im lặng", () => {
    expect(sourceStatusMessage(undefined, ev("queued"), "a.pdf")).toBe(null);
  });
});

describe("reindexMessage", () => {
  it("bắt đầu / kết thúc, còn lại im lặng", () => {
    expect(reindexMessage(null, true)).toBe("Đang tái lập chỉ mục nguồn…");
    expect(reindexMessage(false, true)).toBe("Đang tái lập chỉ mục nguồn…");
    expect(reindexMessage(true, false)).toBe("Đã tái lập chỉ mục nguồn xong.");
    expect(reindexMessage(true, true)).toBe(null);
    expect(reindexMessage(null, false)).toBe(null);
    expect(reindexMessage(false, false)).toBe(null);
  });
});

describe("studioMessage / progressValueText", () => {
  it("Studio bắt đầu / xong", () => {
    expect(studioMessage("Ý chính", "start")).toBe("Đang tạo Ý chính…");
    expect(studioMessage("Ý chính", "done")).toBe("Đã tạo xong Ý chính.");
  });
  it("giá trị đọc của thanh tiến độ", () => {
    expect(progressValueText("Nhúng", 40)).toBe("Nhúng, 40%");
  });
});
