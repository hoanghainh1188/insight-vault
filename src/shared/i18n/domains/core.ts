import type { Widen } from "../translate";

// 123 — khoá dùng chung: nút chung, lỗi người-dùng-thấy (mã UserErrorCode), lỗi AI online (098), thời gian, Cài đặt.

export const coreVi = {
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
    vaultLocked: "Đang sao lưu/khôi phục — thử lại sau giây lát.",
    notebookNameEmpty: "Tên notebook không được để trống.",
    notebookNameTooLong: "Tên notebook tối đa {max} ký tự.",
    notebookNotFound: "Notebook không tồn tại.",
    questionEmpty: "Câu hỏi không được để trống.",
    questionTooLong: "Câu hỏi quá dài (tối đa {max} ký tự).",
    historyTooLong: "Lịch sử hội thoại quá dài.",
    sourceNotFound: "Nguồn không tồn tại.",
    sourcePathMissing: "Nguồn thiếu đường dẫn tệp hoặc URL.",
    sourcePathNotLocal: "Đường dẫn tệp phải là tệp cục bộ (không phải URL).",
    sourceRetryNotError: "Chỉ thử lại nguồn đang lỗi.",
    unsupportedFormat: "Định dạng tệp không hỗ trợ: .{ext}",
    reprocessNotPdf: "Chỉ xử lý lại nguồn PDF.",
    reprocessBusy: "Nguồn đang được xử lý.",
    reprocessBadStatus: "Chỉ xử lý lại nguồn sẵn sàng hoặc lỗi.",
    studioSourceNotReady:
      "Nguồn đã chọn chưa sẵn sàng. Chờ lập chỉ mục xong rồi thử lại.",
    studioNoReadySources:
      "Chưa có nguồn sẵn sàng để tạo Studio. Hãy nạp nguồn trước.",
    studioEmptyOutput: "Mô hình không tạo được nội dung. Vui lòng thử lại.",
    studioNoNotes:
      "Mô hình không trích được ghi chú kèm trích dẫn từ tài liệu. Vui lòng thử lại hoặc chọn mô hình khác.",
    studioSaveFailed: "Lưu kết quả Studio thất bại.",
    chatModelNotSelected: "Chưa chọn mô hình trả lời (chat model).",
    embeddingModelNotSelected: "Chưa chọn mô hình embedding.",
    ollamaHttp: "Ollama trả lỗi {status}.",
    apiKeyMissing: "{provider}: chưa nhập khóa API.",
    modelNotSelected: "{provider}: chưa chọn mô hình.",
    apiKeyInvalidInput: "Khóa API hoặc nhà cung cấp không hợp lệ.",
  },
  online: {
    auth: "Khóa API không hợp lệ hoặc đã hết hạn.",
    "rate-limit": "Nhà cung cấp đang giới hạn tốc độ, vui lòng thử lại sau.",
    timeout: "Máy chủ AI online phản hồi quá lâu (hết thời gian chờ).",
    network: "Không kết nối được tới máy chủ AI online (kiểm tra mạng).",
    server: "Máy chủ AI online gặp lỗi, vui lòng thử lại.",
    unknown: "Gọi AI online thất bại.",
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

export const coreEn: Widen<typeof coreVi> = {
  common: {
    cancel: "Cancel",
    close: "Close",
    save: "Save",
    retry: "Retry",
    delete: "Delete",
    copy: "Copy",
    copied: "Copied",
  },
  time: {
    justNow: "just now",
    minutesAgo: { one: "{count} minute ago", other: "{count} minutes ago" },
    hoursAgo: { one: "{count} hour ago", other: "{count} hours ago" },
    yesterday: "yesterday",
    daysAgo: { one: "{count} day ago", other: "{count} days ago" },
    lastWeek: "last week",
  },
  errors: {
    unexpected: "Something went wrong. Please try again.",
    vaultLocked: "A backup or restore is in progress — try again in a moment.",
    notebookNameEmpty: "Notebook name can't be empty.",
    notebookNameTooLong: "Notebook name can be at most {max} characters.",
    notebookNotFound: "Notebook not found.",
    questionEmpty: "Question can't be empty.",
    questionTooLong: "Question is too long (max {max} characters).",
    historyTooLong: "Conversation history is too long.",
    sourceNotFound: "Source not found.",
    sourcePathMissing: "Source is missing a file path or URL.",
    sourcePathNotLocal: "File path must be a local file (not a URL).",
    sourceRetryNotError: "Only failed sources can be retried.",
    unsupportedFormat: "Unsupported file type: .{ext}",
    reprocessNotPdf: "Only PDF sources can be reprocessed.",
    reprocessBusy: "This source is being processed.",
    reprocessBadStatus: "Only ready or failed sources can be reprocessed.",
    studioSourceNotReady:
      "The selected source isn't ready yet. Wait for indexing to finish, then try again.",
    studioNoReadySources:
      "No sources are ready for Studio yet. Add a source first.",
    studioEmptyOutput:
      "The model didn't produce any content. Please try again.",
    studioNoNotes:
      "The model couldn't extract cited notes from the documents. Try again or choose another model.",
    studioSaveFailed: "Couldn't save the Studio result.",
    chatModelNotSelected: "No answer (chat) model selected.",
    embeddingModelNotSelected: "No embedding model selected.",
    ollamaHttp: "Ollama returned error {status}.",
    apiKeyMissing: "{provider}: no API key entered.",
    modelNotSelected: "{provider}: no model selected.",
    apiKeyInvalidInput: "Invalid API key or provider.",
  },
  online: {
    auth: "The API key is invalid or has expired.",
    "rate-limit":
      "The provider is rate-limiting requests. Please try again later.",
    timeout: "The online AI server took too long to respond (timed out).",
    network: "Couldn't reach the online AI server (check your network).",
    server: "The online AI server returned an error. Please try again.",
    unknown: "The online AI request failed.",
  },
  settings: {
    title: "Settings",
    language: {
      title: "Language",
      description:
        "Interface language. Chat answers follow the language of your question; Studio follows the interface language.",
      auto: "Automatic (system language)",
      saveFailed: "Couldn't change the language. Please try again.",
    },
  },
};
