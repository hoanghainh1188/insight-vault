import type { Widen } from "../translate";

// 123 — khoá dịch domain "viewer" (trình xem nguồn — overlay mở theo chip [n] hoặc từ cột Nguồn).

export const viewerVi = {
  label: "Trình xem nguồn",
  back: "← Quay lại chat",
  titleFallback: "Nguồn",
  citationOf: "Nguồn của trích dẫn [{n}]",
  stale: "Nguồn đã được xử lý lại — vị trí trích dẫn cũ không còn chính xác",
  prevPage: "Trang trước",
  nextPage: "Trang sau",
  pageOf: "Trang {page}/{total}",
  pageMark: "— Trang {page} —",
  loading: "Đang tải nguồn…",
  missing: "Nguồn không còn tồn tại.",
  empty: "(Nguồn trống)",
  // 147 (e): lưới bảng
  table: { label: "Bảng {i} — trang {page}" },
  view: {
    label: "Cách hiển thị bảng",
    grid: "Dạng lưới",
    text: "Dạng văn bản",
  },
  audioError:
    "Không phát được file âm thanh gốc (có thể đã bị xoá hoặc di chuyển). Bản bóc băng bên dưới vẫn xem được.",
  videoError:
    "Không phát được file video gốc (có thể đã bị xoá hoặc di chuyển). Bản bóc băng bên dưới vẫn xem được.",
  imageError:
    "Không mở được ảnh gốc (có thể đã bị xoá hoặc di chuyển). Bản bóc băng bên dưới vẫn xem được.",
} as const;

export const viewerEn: Widen<typeof viewerVi> = {
  label: "Source viewer",
  back: "← Back to chat",
  titleFallback: "Source",
  citationOf: "Source of citation [{n}]",
  stale:
    "This source has been reprocessed — the old citation position is no longer accurate",
  prevPage: "Previous page",
  nextPage: "Next page",
  pageOf: "Page {page}/{total}",
  pageMark: "— Page {page} —",
  loading: "Loading source…",
  missing: "This source no longer exists.",
  empty: "(Empty source)",
  table: { label: "Table {i} — page {page}" },
  view: { label: "Table display", grid: "Grid", text: "Text" },
  audioError:
    "Couldn't play the original audio file (it may have been deleted or moved). The transcript below is still available.",
  videoError:
    "Couldn't play the original video file (it may have been deleted or moved). The transcript below is still available.",
  imageError:
    "Couldn't open the original image (it may have been deleted or moved). The extracted text below is still available.",
};
