# Contract — kênh IPC `meeting:*` (186)

Mọi kênh khai báo trong `CHANNELS` (`src/shared/ipc/channels.ts`), whitelist (`WHITELISTED_CHANNELS`), preload hàm riêng từng kênh (`src/preload/index.ts`, không có
`invoke` chung), handler trong `src/main/ipc/register.ts` (`safeHandle` / `safeHandleWithSender`). Lỗi trả `UserFacingError(code)`; renderer dịch mã qua i18n. Main
**không log** payload (tiêu đề, transcript, audio). Kiểm hợp lệ theo `data-model.md` §6.

Ký hiệu: **I** = invoke (renderer→main, có phản hồi) · **S** = send (renderer→main, không phản hồi) · **P** = push (main→renderer).

## PR A

| Kênh | Kiểu | Vào | Ra | Ghi chú |
|---|---|---|---|---|
| `meeting:prepare` | I | `{ notebookId }` | `{ micStatus: "granted"\|"notDetermined"\|"denied"\|"restricted"\|"unknown", modelReady: boolean, modelSizeMb: number, minutesRemaining: number, canStart: boolean, onlineActive: boolean, recordingActive: boolean, lastDeviceLabel?: string, lastLanguageMode?: LanguageMode }` | Mở cổng quyền 15 s (R11). macOS hỏi quyền OS ở đây. `last*` đọc từ electron-store (D15). `canStart=false` khi `minutesRemaining<10` hoặc đang có phiên. |
| `meeting:start` | I (sender) | `{ notebookId, title, languageMode, deviceLabel? }` | `{ sessionId, sourceId }` | Gọi **sau** khi `getUserMedia` thành công (FR-005). Lưu `deviceLabel` + `languageMode` vào electron-store (D15). Ghi `ownerId`. Lỗi: `meetingAlreadyRecording`, `meetingDiskLow`, `notebookNotFound`, `invalidInput`. |
| `meeting:audio` | S | `{ sessionId, seq, pcm: ArrayBuffer }` | — | R4. Sai ⇒ bỏ + đếm, không ném. Chỉ từ `ownerId`. |
| `meeting:pause` | I (sender) | `{ sessionId, reason: "user"\|"deviceLost" }` | `MeetingState` | Đóng phân đoạn. |
| `meeting:resume` | I (sender) | `{ sessionId, deviceLabel? }` | `MeetingState` | Mở lại cổng quyền 15 s; phân đoạn mới. |
| `meeting:stop` | I (sender) | `{ sessionId }` | `{ sourceId }` | ⇒ `stopping` ⇒ `finalizing` (nền). |
| `meeting:status` | I | — | `MeetingState \| null` | Renderer gắn lại sau reload/điều hướng. |
| `meeting:rename` | I | `{ sourceId, title }` | `{ ok: true }` | Chỉ `kind="meeting"`. |
| `meeting:state` | P | `MeetingState` | — | Chỉ tới `ownerId` (và cửa sổ chính). Phát khi đổi phase, mỗi 1 s thời lượng, đổi mức đĩa/lag/ngôn ngữ. |

`MeetingState`:

```ts
{
  sessionId: string; sourceId: string; notebookId: string; title: string;
  phase: "recording" | "paused" | "stopping" | "finalizing" | "interrupted";
  durationSec: number;                // thời gian audio
  segments: { index: number; durationSec: number; closed: boolean }[]; // để renderer quy đổi thời gian ⇒ ?seg=n (PR B)
  pauseReason?: "user" | "deviceLost";
  diskLevel: "ok" | "warn" | "urgent"; minutesRemaining: number;
  transcriptLagging: boolean;          // PR B
  modelReady: boolean;                 // PR B
  language: { mode: "auto"|"vi"|"en"|"multi"; current: "vi"|"en"|null; status: "detecting"|"locked"|"manual"|"multi"; suggestion?: "vi"|"en" }; // PR B
}
```

Tiến độ hoàn tất: **dùng lại `source:progress`** (`step: "parse"`, `progress` 0–0,8 theo phân đoạn, sau đó các bước chunk/embed/store sẵn có). `SourceSummary` thêm
`meetingPhase?: "recording"|"paused"|"stopping"|"finalizing"|"interrupted"|"incomplete"|"done"` và `transcriptQuality?: "final"|"draft"`.

## PR B

| Kênh | Kiểu | Vào | Ra | Ghi chú |
|---|---|---|---|---|
| `meeting:draft` | P | `{ sessionId, windows: DraftWindow[] }` | — | `DraftWindow = { id, tStart, tEnd, text, pending }`; chỉ tới owner. |
| `meeting:setLanguage` | I | `{ sessionId, action: "lock", lang: "vi"\|"en" } \| { sessionId, action: "acceptSuggestion" } \| { sessionId, action: "dismissSuggestion" }` | `MeetingState` | R7. |
| `meeting:mark` | I | `{ sessionId, kind, tStart, tEnd? }` | `{ markerId }` | Cho phép khi `recording`/`paused`. |
| `meeting:listMarkers` | I | `{ sourceId }` | `MeetingMarker[]` | `{ id, kind, tStart, tEnd }`. |
| `meeting:downloadModel` | I | — | `{ ok: true }` | Tải model nháp + chốt; chỉ báo riêng tư `sending/model` trong lúc tải (103). |

## PR C1

| Kênh | Kiểu | Vào | Ra | Ghi chú |
|---|---|---|---|---|
| `meeting:listRecoverable` | I | `{ notebookId? }` | `RecoverableSession[]` | `{ sessionId, sourceId, notebookId, title, durationSec, startedAt }`; không `notebookId` ⇒ mọi notebook (huy hiệu trang Notebooks). |
| `meeting:recover` | I | `{ sessionId, action: "finalize"\|"keepIncomplete"\|"discard" }` | `{ ok: true }` | `discard` xoá vĩnh viễn — renderer đã xác nhận. |
| `meeting:finalizeAgain` | I | `{ sourceId }` | `{ ok: true }` | "Hoàn tất transcript" (incomplete) / "Chốt lại" (quality=draft). |
| `meeting:recoverable` | P | `{ count }` | — | Sau khởi động / khi danh sách đổi. |

`before-quit` / đóng cửa sổ khi đang ghi: hộp thoại **ở main** (`dialog.showMessageBox`, chuỗi i18n theo ngôn ngữ UI) — không có kênh.

## PR C2

| Kênh | Kiểu | Vào | Ra | Ghi chú |
|---|---|---|---|---|
| `meeting:getTranscript` | I | `{ sourceId }` | `{ spans: {charStart,charEnd,tStart,tEnd}[], markers: MeetingMarker[], pauseGaps: {atSec,wallSeconds,reason}[], language: string\|null, quality: "final"\|"draft"\|null, durationSec, startedAt, endedAt }` | Văn bản lấy từ `source:getContent` sẵn có. |
| `meeting:updateMarker` | I | `{ markerId, kind }` | `{ ok: true }` | |
| `meeting:deleteMarker` | I | `{ markerId }` | `{ ok: true }` | |
| `meeting:exportMarkdown` | I (sender) | `{ sourceId }` | `StudioExportResult` (`{ saved, path? }`) | Main dựng nội dung; tái dùng `exportMarkdown` + `sanitizeName`. `path` chỉ trả để hiển thị toast như Studio. |

## Thay đổi kênh có sẵn

| Kênh | Thay đổi | PR |
|---|---|---|
| `source:list` / `SourceSummary` | thêm `meetingPhase?`, `transcriptQuality?` | A |
| `source:getContent` / `SourceContent.kind` | có thể là `"meeting"` | A |
| `source:remove` | với meeting: huỷ phiên/hoàn tất + xoá thư mục | A |
| `source:retry`, `source:relink` | `meeting` ⇒ lỗi `notSupported` | A |
| `notebook:delete` | lỗi `meetingRecording` khi notebook đang có phiên ghi | A |
| `iv-media://source/<id>[?seg=n]` | chấp nhận `meeting`; `seg` chỉ cho meeting chưa ghép (R10) | A (`seg` dùng từ B) |
| `backup:*` | snapshot gồm `meetings/`; hộp sao lưu có dòng dung lượng | A |

## Quyền (R11)

`setPermissionRequestHandler` / `setPermissionCheckHandler` dùng `decideMediaPermission` / `decidePermissionCheck` (thuần). Mọi quyền khác (camera, geolocation,
notifications, clipboard-read…) giữ **từ chối** như hiện nay. `setDevicePermissionHandler` giữ `false`.

## Worker ASR (nội bộ main ↔ utilityProcess, không phải IPC renderer)

Xem `research.md` R5. Tin nhắn kiểm bằng `parseWorkerMessage` thuần; đường dẫn tệp gửi cho worker luôn nằm trong `<userData>/meetings/` (main kiểm prefix trước khi gửi).
