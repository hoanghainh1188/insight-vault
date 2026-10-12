import type { Widen } from "../translate";

// 186 — khoá dịch domain "meeting" (Ghi cuộc họp). error.<code> theo mã lỗi main trả về; phase.<phase> theo
// MeetingPhase; language.<mode> theo LanguageMode. Chuỗi UI bổ sung dần theo từng PR (A → B → C1 → C2).

export const meetingVi = {
  entry: {
    record: "Ghi cuộc họp",
  },
  start: {
    title: "Ghi cuộc họp",
    nameLabel: "Tên cuộc họp",
    defaultName: "Cuộc họp {date}, {time}",
    notebookLabel: "Notebook",
    micLabel: "Microphone",
    languageLabel: "Ngôn ngữ",
    privacy: "Âm thanh và transcript được xử lý trên máy này.",
    privacyOnline: "Hỏi đáp và Studio về cuộc họp sẽ dùng AI online đang bật.",
    modelMissing:
      "Lần đầu cần tải model nhận dạng (~{size} MB) — cần Internet.",
    noMic:
      "Không tìm thấy microphone nào. Hãy cắm hoặc bật microphone rồi thử lại.",
    diskLow:
      "Ổ đĩa chỉ đủ ghi khoảng {minutes} phút — hãy giải phóng dung lượng trước khi ghi.",
    begin: "Bắt đầu ghi",
  },
  language: {
    auto: "Tự động",
    vi: "Tiếng Việt",
    en: "English",
    multi: "Đa ngôn ngữ",
  },
  permission: {
    deniedMac:
      "InsightVault chưa được phép dùng microphone. Mở Cài đặt hệ thống → Quyền riêng tư & Bảo mật → Microphone, bật InsightVault rồi thử lại.",
    deniedWin:
      "InsightVault chưa được phép dùng microphone. Mở Settings → Privacy & security → Microphone, cho phép ứng dụng dùng microphone rồi thử lại.",
  },
  recording: {
    recording: "Đang ghi",
    paused: "Đã tạm dừng — không thu âm",
    savedLocally: "Lưu trên máy",
    pause: "Tạm dừng",
    resume: "Tiếp tục",
    end: "Kết thúc ghi",
    endConfirmTitle: "Kết thúc ghi?",
    endConfirmBody:
      "Cuộc họp đã ghi {duration}. Sau khi kết thúc, app sẽ chốt transcript và lập chỉ mục.",
    endConfirmOk: "Kết thúc",
    transcriptAfterEnd: "Transcript sẽ có sau khi kết thúc ghi.",
    backToRecording: "Quay lại",
  },
  finalize: {
    status: "Đang chốt transcript và lập chỉ mục",
    duration: "Thời lượng: {duration}",
    backToNotebook: "Về notebook",
    openWhenDone: "Mở khi hoàn tất",
    readyToast: "Cuộc họp “{title}” đã sẵn sàng.",
    open: "Mở",
  },
  phase: {
    recording: "Đang ghi",
    paused: "Đã tạm dừng",
    stopping: "Đang hoàn tất",
    finalizing: "Đang hoàn tất",
    interrupted: "Bị gián đoạn",
    incomplete: "Chưa hoàn thiện",
    done: "Sẵn sàng",
  },
  error: {
    meetingRecording:
      "Notebook này đang ghi cuộc họp — hãy kết thúc ghi trước.",
    meetingAlreadyRecording:
      "Đang có một cuộc họp được ghi. Hãy kết thúc ghi trước khi bắt đầu cuộc họp mới.",
    meetingDiskLow: "Ổ đĩa không đủ dung lượng để ghi.",
    notSupported: "Thao tác này không áp dụng cho nguồn cuộc họp.",
    captureFailed: "Không ghi được âm thanh. Dữ liệu đã ghi vẫn được giữ.",
  },
} as const;

export const meetingEn: Widen<typeof meetingVi> = {
  entry: {
    record: "Record meeting",
  },
  start: {
    title: "Record meeting",
    nameLabel: "Meeting name",
    defaultName: "Meeting {date}, {time}",
    notebookLabel: "Notebook",
    micLabel: "Microphone",
    languageLabel: "Language",
    privacy: "Audio and transcript are processed on this computer.",
    privacyOnline:
      "Q&A and Studio about the meeting will use the online AI that is turned on.",
    modelMissing:
      "The first time, the speech recognition model (~{size} MB) must be downloaded — Internet required.",
    noMic:
      "No microphone found. Connect or turn on a microphone and try again.",
    diskLow:
      "The disk only has room for about {minutes} minutes of recording — free up space before recording.",
    begin: "Start recording",
  },
  language: {
    auto: "Automatic",
    vi: "Vietnamese",
    en: "English",
    multi: "Multilingual",
  },
  permission: {
    deniedMac:
      "InsightVault is not allowed to use the microphone. Open System Settings → Privacy & Security → Microphone, turn on InsightVault, then try again.",
    deniedWin:
      "InsightVault is not allowed to use the microphone. Open Settings → Privacy & security → Microphone, allow apps to use the microphone, then try again.",
  },
  recording: {
    recording: "Recording",
    paused: "Paused — not recording",
    savedLocally: "Saved on this computer",
    pause: "Pause",
    resume: "Resume",
    end: "End recording",
    endConfirmTitle: "End recording?",
    endConfirmBody:
      "The meeting has been recorded for {duration}. After ending, the app will finalize the transcript and index it.",
    endConfirmOk: "End",
    transcriptAfterEnd:
      "The transcript will be available after the recording ends.",
    backToRecording: "Back",
  },
  finalize: {
    status: "Finalizing transcript and indexing",
    duration: "Duration: {duration}",
    backToNotebook: "Back to notebook",
    openWhenDone: "Open when done",
    readyToast: "Meeting “{title}” is ready.",
    open: "Open",
  },
  phase: {
    recording: "Recording",
    paused: "Paused",
    stopping: "Finalizing",
    finalizing: "Finalizing",
    interrupted: "Interrupted",
    incomplete: "Incomplete",
    done: "Ready",
  },
  error: {
    meetingRecording:
      "This notebook is recording a meeting — end the recording first.",
    meetingAlreadyRecording:
      "A meeting is already being recorded. End that recording before starting a new one.",
    meetingDiskLow: "Not enough disk space to record.",
    notSupported: "This action does not apply to meeting sources.",
    captureFailed:
      "Audio could not be recorded. The audio recorded so far is kept.",
  },
};
