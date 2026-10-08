// 123 — tệp dịch NGÔN NGỮ NGUỒN (tiếng Việt). Kiểu `Messages` suy từ đây; en.ts phải đủ khoá + cùng placeholder.
// Quy ước: khoá lồng theo domain; lá là chuỗi hoặc { one, other } (plural); placeholder dạng {name}; không HTML.

export const vi = {
  common: {
    cancel: "Huỷ",
    close: "Đóng",
    save: "Lưu",
    retry: "Thử lại",
    delete: "Xoá",
    copy: "Sao chép",
    copied: "Đã sao chép",
  },
  time: {
    justNow: "vừa xong",
    minutesAgo: { one: "{count} phút trước", other: "{count} phút trước" },
    hoursAgo: { one: "{count} giờ trước", other: "{count} giờ trước" },
    yesterday: "hôm qua",
    daysAgo: { one: "{count} ngày trước", other: "{count} ngày trước" },
    lastWeek: "tuần trước",
  },
  errors: {
    unexpected: "Đã có lỗi xảy ra. Vui lòng thử lại.",
  },
  settings: {
    title: "Cài đặt",
    language: {
      title: "Ngôn ngữ",
      description:
        "Ngôn ngữ của giao diện. Câu trả lời trong Chat theo ngôn ngữ câu hỏi; Studio theo ngôn ngữ giao diện.",
      auto: "Tự động (theo hệ điều hành)",
      saveFailed: "Không đổi được ngôn ngữ. Vui lòng thử lại.",
    },
  },
} as const;
