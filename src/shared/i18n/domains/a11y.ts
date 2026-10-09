import type { Widen } from "../translate";

// 123 — câu thông báo cho trình đọc màn hình (091). Dịch TRƯỚC khi announce() (hàng đợi LiveRegion giữ chuỗi).

export const a11yVi = {
  chatStarted: "Đang soạn câu trả lời…",
  chatCancelled: "Đã huỷ câu trả lời đang soạn vì chuyển notebook.",
  chatStopped: "Đã dừng. Giữ phần câu trả lời đã nhận.",
  chatNotFound: "Không tìm thấy thông tin trong nguồn.",
  chatDone: "Đã có câu trả lời.",
  chatDoneCitations: {
    one: "Đã có câu trả lời, {count} trích dẫn.",
    other: "Đã có câu trả lời, {count} trích dẫn.",
  },
  sourceProcessing: "Đang xử lý nguồn.",
  sourceProcessingNamed: "Đang xử lý nguồn “{title}”.",
  sourceAwaiting: "Nguồn đang chờ nhúng.",
  sourceAwaitingNamed: "Nguồn “{title}” đang chờ nhúng.",
  sourceReady: "Nguồn đã sẵn sàng.",
  sourceReadyNamed: "Nguồn “{title}” đã sẵn sàng.",
  sourceError: "Nguồn lỗi: {error}.",
  sourceErrorNamed: "Nguồn “{title}” lỗi: {error}.",
  sourceErrorFallback: "không xử lý được",
  reindexStart: "Đang tái lập chỉ mục nguồn…",
  reindexDone: "Đã tái lập chỉ mục nguồn xong.",
  studioStart: "Đang tạo {label}…",
  studioDone: "Đã tạo xong {label}.",
  // 146 (clarify #5): đổi pha / mốc giữa pha đọc
  studioProgressReading: "{label}: đang đọc phần {i}/{n}.",
  studioProgressCondensing: "{label}: đang rút gọn ghi chú.",
  studioProgressWriting: "{label}: đang viết.",
  studioCancelled: "Đã huỷ tạo {label}.", // 149
  progressValue: "{step}, {pct}%",
} as const;

export const a11yEn: Widen<typeof a11yVi> = {
  chatStarted: "Writing the answer…",
  chatCancelled:
    "The answer in progress was cancelled because you switched notebooks.",
  chatStopped: "Stopped. The part of the answer received so far is kept.",
  chatNotFound: "No information found in the sources.",
  chatDone: "The answer is ready.",
  chatDoneCitations: {
    one: "The answer is ready, {count} citation.",
    other: "The answer is ready, {count} citations.",
  },
  sourceProcessing: "Processing source.",
  sourceProcessingNamed: "Processing source “{title}”.",
  sourceAwaiting: "Source is waiting for embedding.",
  sourceAwaitingNamed: "Source “{title}” is waiting for embedding.",
  sourceReady: "Source is ready.",
  sourceReadyNamed: "Source “{title}” is ready.",
  sourceError: "Source failed: {error}.",
  sourceErrorNamed: "Source “{title}” failed: {error}.",
  sourceErrorFallback: "couldn't be processed",
  reindexStart: "Reindexing sources…",
  reindexDone: "Finished reindexing sources.",
  studioStart: "Creating {label}…",
  studioDone: "Finished creating {label}.",
  studioProgressReading: "{label}: reading part {i} of {n}.",
  studioProgressCondensing: "{label}: condensing notes.",
  studioProgressWriting: "{label}: writing.",
  studioCancelled: "Cancelled creating {label}.",
  progressValue: "{step}, {pct}%",
};
