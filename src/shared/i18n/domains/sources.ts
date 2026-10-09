import type { Widen } from "../translate";

// 123 — khoá dịch domain "sources" (cột Nguồn, thêm nguồn, trạng thái, xử lý lại, chọn lại tệp gốc).
// error.<code>: nhãn lỗi nguồn theo SourceErrorCode (src/shared/codes/source-error.ts) — main lưu/gửi MÃ.

export const sourcesVi = {
  status: {
    queued: "Trong hàng đợi",
    processing: "Đang xử lý…",
    awaiting_embedding: "Chờ nhúng",
    ready: "Sẵn sàng",
    error: "Lỗi",
  },
  step: {
    parse: "Phân tích",
    clean: "Làm sạch",
    chunk: "Chia đoạn",
    embed: "Nhúng",
    store: "Lưu chỉ mục",
    done: "Hoàn tất",
  },
  aggregate: {
    indexed: {
      one: "{count} nguồn · đã lập chỉ mục",
      other: "{count} nguồn · đã lập chỉ mục",
    },
    pending: {
      one: "{count} nguồn · đang xử lý {pending}",
      other: "{count} nguồn · đang xử lý {pending}",
    },
  },
  kind: {
    web: "Web",
    audio: "Âm thanh",
    video: "Video",
    image: "Hình ảnh",
    pdfPages: { one: "PDF · {count} trang", other: "PDF · {count} trang" },
  },
  list: {
    label: "Nguồn",
    add: "Thêm nguồn",
    empty: "Chưa có nguồn. Bấm “Thêm nguồn” để nạp tài liệu.",
    resizeSources: "Kéo đổi độ rộng cột Nguồn",
    resizeStudio: "Kéo đổi độ rộng cột Studio",
  },
  item: {
    progressLabel: "Tiến độ xử lý {title}",
    relink: "Chọn lại tệp gốc…",
    relinkAria: "Chọn lại tệp gốc cho {title}",
    deleteAria: "Xoá {title}",
    retryAria: "Thử lại {title}",
    reprocess: "Xử lý lại",
    reprocessAria: "Xử lý lại {title} để giữ bố cục",
    reprocessHint: "Xử lý lại để giữ bố cục",
    // 147: PDF đã có bố cục (phiên bản 2)
    reprocessHintV2: "Xử lý lại để cải thiện bảng, trang xoay và gạch nối",
    reprocessAriaV2:
      "Xử lý lại {title} để cải thiện bảng, trang xoay và gạch nối",
    reprocessProgressLabel: "Tiến độ xử lý lại {title}",
    reprocessRunning: "Đang xử lý lại · {pct}%",
    reprocessConfirmLabel: "Xử lý lại {title}",
    reprocessConfirmBody:
      "Trích xuất lại PDF để giữ dòng, cột và bảng. Các trích dẫn [n] cũ tới nguồn này vẫn mở được nhưng sẽ không còn tô sáng đúng vị trí.",
  },
  reprocess: {
    mismatch:
      "Tệp gốc đã bị sửa so với lúc nạp — không thể xử lý lại (trích dẫn sẽ lệch). Hãy nạp tệp như một nguồn mới.",
    done: "Đã xử lý lại “{title}”.",
  },
  relink: {
    ok: "Đã liên kết lại tệp gốc.",
    mismatch:
      "Tệp đã chọn khác nội dung với tệp đã nạp — trích dẫn sẽ trỏ sai chỗ nên không thể dùng. Hãy chọn đúng tệp gốc, hoặc nạp tệp này thành nguồn mới.",
    wrongType: "Tệp đã chọn không đúng loại của nguồn này.",
    error: "Không đọc được tệp đã chọn.",
    notApplicable: "Nguồn này không có tệp gốc để liên kết lại.",
    busy: "Nguồn đang được xử lý — thử lại sau giây lát.",
    locked: "Đang sao lưu/khôi phục — thử lại sau giây lát.",
    checking: "Đang kiểm tra tệp…",
  },
  add: {
    title: "Thêm nguồn",
    tabFile: "Tệp",
    tabUrl: "URL",
    tabVideo: "Video",
    tabImage: "Hình ảnh",
    tabVideoHint: "Kéo tệp video (mp4/mov/webm/mkv) hoặc audio vào tab Tệp",
    tabImageHint:
      "Kéo tệp ảnh (png/jpg/webp/bmp/tiff) vào tab Tệp — OCR trích chữ",
    dropPrompt: "Kéo-thả tệp vào đây hoặc bấm để chọn",
    formats:
      "PDF/.docx/.txt/.md · audio .wav/.mp3/.flac/.ogg/.m4a/.aac · video .mp4/.mov/.webm/.mkv · ảnh .png/.jpg/.webp/.bmp/.tiff",
    dropHint: "Xử lý ngay trên máy · {formats} (tự bóc băng / OCR)",
    originNote:
      "Video/ảnh phát/hiển thị từ vị trí file gốc; nếu xoá/di chuyển file, sẽ không mở lại được (bản bóc băng/OCR vẫn xem được).",
    unsupported: "Không hỗ trợ: {files} ({formats}).",
    urlInvalid: "Nhập URL bắt đầu bằng http:// hoặc https://",
    urlAdd: "Thêm",
    duplicateFile: "Một nguồn có thể đã tồn tại trong notebook.",
    duplicateUrl: "Nguồn URL này có thể đã tồn tại.",
  },
  error: {
    extract: "Lỗi trích xuất",
    embed: "Lỗi nhúng",
    store: "Lỗi lưu trữ",
    generic: "Lỗi",
    fetch: "Lỗi tải trang",
    tooLarge: "Tệp quá lớn",
    interrupted: "Gián đoạn khi nạp — thử lại",
    reprocessFailed: "Xử lý lại thất bại — vẫn dùng bản cũ.",
    reprocessChanged:
      "Tệp gốc đã bị sửa so với lúc nạp — xử lý lại bị huỷ, vẫn dùng bản cũ.",
    reprocessVaultLocked:
      "Đang sao lưu/khôi phục — thử lại sau giây lát. Xử lý lại bị huỷ, vẫn dùng bản cũ.",
    unknown: "Lỗi không xác định",
  },
} as const;

export const sourcesEn: Widen<typeof sourcesVi> = {
  status: {
    queued: "Queued",
    processing: "Processing…",
    awaiting_embedding: "Awaiting embedding",
    ready: "Ready",
    error: "Error",
  },
  step: {
    parse: "Parsing",
    clean: "Cleaning",
    chunk: "Chunking",
    embed: "Embedding",
    store: "Saving index",
    done: "Done",
  },
  aggregate: {
    indexed: {
      one: "{count} source · indexed",
      other: "{count} sources · indexed",
    },
    pending: {
      one: "{count} source · {pending} processing",
      other: "{count} sources · {pending} processing",
    },
  },
  kind: {
    web: "Web",
    audio: "Audio",
    video: "Video",
    image: "Image",
    pdfPages: { one: "PDF · {count} page", other: "PDF · {count} pages" },
  },
  list: {
    label: "Sources",
    add: "Add source",
    empty: "No sources yet. Click “Add source” to import documents.",
    resizeSources: "Drag to resize the Sources column",
    resizeStudio: "Drag to resize the Studio column",
  },
  item: {
    progressLabel: "Processing progress for {title}",
    relink: "Choose original file…",
    relinkAria: "Choose original file for {title}",
    deleteAria: "Delete {title}",
    retryAria: "Retry {title}",
    reprocess: "Reprocess",
    reprocessAria: "Reprocess {title} to keep the layout",
    reprocessHint: "Reprocess to keep the layout",
    reprocessHintV2:
      "Reprocess to improve tables, rotated pages and hyphenation",
    reprocessAriaV2:
      "Reprocess {title} to improve tables, rotated pages and hyphenation",
    reprocessProgressLabel: "Reprocessing progress for {title}",
    reprocessRunning: "Reprocessing · {pct}%",
    reprocessConfirmLabel: "Reprocess {title}",
    reprocessConfirmBody:
      "Re-extract the PDF to keep lines, columns and tables. Existing [n] citations to this source will still open but will no longer highlight the exact position.",
  },
  reprocess: {
    mismatch:
      "The original file has changed since it was imported — it can't be reprocessed (citations would be misaligned). Import the file as a new source instead.",
    done: "Reprocessed “{title}”.",
  },
  relink: {
    ok: "Original file relinked.",
    mismatch:
      "The selected file's content differs from the imported file — citations would point to the wrong place, so it can't be used. Choose the correct original file, or import this file as a new source.",
    wrongType: "The selected file isn't the right type for this source.",
    error: "Couldn't read the selected file.",
    notApplicable: "This source has no original file to relink.",
    busy: "The source is being processed — try again in a moment.",
    locked: "A backup or restore is in progress — try again in a moment.",
    checking: "Checking file…",
  },
  add: {
    title: "Add source",
    tabFile: "File",
    tabUrl: "URL",
    tabVideo: "Video",
    tabImage: "Image",
    tabVideoHint:
      "Drag video files (mp4/mov/webm/mkv) or audio into the File tab",
    tabImageHint:
      "Drag image files (png/jpg/webp/bmp/tiff) into the File tab — OCR extracts the text",
    dropPrompt: "Drag and drop files here or click to choose",
    formats:
      "PDF/.docx/.txt/.md · audio .wav/.mp3/.flac/.ogg/.m4a/.aac · video .mp4/.mov/.webm/.mkv · images .png/.jpg/.webp/.bmp/.tiff",
    dropHint:
      "Processed right on this device · {formats} (automatic transcription / OCR)",
    originNote:
      "Videos and images play/display from the original file's location; if the file is deleted or moved, it can't be opened again (the transcript/OCR text remains viewable).",
    unsupported: "Not supported: {files} ({formats}).",
    urlInvalid: "Enter a URL starting with http:// or https://",
    urlAdd: "Add",
    duplicateFile: "A source may already exist in this notebook.",
    duplicateUrl: "This URL source may already exist.",
  },
  error: {
    extract: "Extraction failed",
    embed: "Embedding failed",
    store: "Storage failed",
    generic: "Error",
    fetch: "Couldn't load the page",
    tooLarge: "File too large",
    interrupted: "Interrupted while importing — retry",
    reprocessFailed: "Reprocessing failed — still using the previous version.",
    reprocessChanged:
      "The original file has changed since it was imported — reprocessing cancelled, still using the previous version.",
    reprocessVaultLocked:
      "A backup or restore is in progress — try again in a moment. Reprocessing cancelled, still using the previous version.",
    unknown: "Unknown error",
  },
};
