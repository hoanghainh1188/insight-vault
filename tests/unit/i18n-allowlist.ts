// 123 (FR-011, research R11): ngoại lệ CÓ CHỦ ĐÍCH cho test quét chuỗi tiếng Việt viết cứng. Mỗi mục: tệp + lý do.
// Thêm mục mới phải có lý do rõ — chuỗi giao diện LUÔN đi qua tệp dịch (src/shared/i18n/domains/*).

export const VI_LITERAL_ALLOWLIST: ReadonlyArray<{
  file: string;
  reason: string;
}> = [
  {
    file: "src/shared/codes/source-error.ts",
    reason:
      "Bảng ánh xạ nhãn lỗi tiếng Việt CŨ ⇒ mã (migration #10 + lớp phòng thủ khi đọc).",
  },
  {
    file: "src/shared/i18n/languages.ts",
    reason:
      "Tên tự xưng của ngôn ngữ ('Tiếng Việt') — hiển thị bằng chính ngôn ngữ đó (FR-003).",
  },
  {
    file: "src/main/services/studio/prompt.ts",
    reason:
      "Nhãn FAQ 'Hỏi/Đáp' trong lời nhắc khi ngôn ngữ đầu ra là tiếng Việt (nội dung gửi model, không phải UI).",
  },
  {
    file: "src/main/services/rag/prompt.ts",
    reason:
      "Ví dụ nhãn '(không dựa trên nguồn)' (chế độ Mở rộng, Constitution II) + câu cố định 'Không tìm thấy trong nguồn.' dẫn hướng model khi nguồn không có câu trả lời (nội dung gửi model, không phải UI).",
  },
];
