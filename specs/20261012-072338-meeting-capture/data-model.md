# Data model — Meeting Capture (186)

Tất cả thay đổi DB nằm trong **migration v12** (append-only, một giao dịch, `PRAGMA user_version = 12`) — giao ở **PR A**, kể cả bảng/cột chỉ PR sau mới dùng, để
chỉ có một lần nâng cấp dữ liệu. Không rebuild bảng `source` (A9): `kind` không có CHECK từ v5, `status` giữ 5 giá trị.

## 1. `SourceKind` (shared)

`src/shared/ipc/types.ts:224`: thêm `"meeting"`.

| Nơi rẽ theo `kind` | Thay đổi |
|---|---|
| `SIZE_LIMITS` | `meeting: Number.POSITIVE_INFINITY` (không dùng — meeting không đi `assertWithinLimit`) |
| `detectKindFromPath` | **không** trả `meeting` |
| `media-serve.ts` | chấp nhận `meeting`, đường dẫn từ `meetingFiles.resolvePlayback` (R10) |
| `SourceViewer.tsx` | `kind === "meeting"` ⇒ player audio; PR C2 ⇒ `MeetingViewer` |
| `pipeline.retry` / `relink` | không áp dụng cho `meeting` (trả mã lỗi `notSupported`) |
| `resumeInterrupted` | bỏ qua `meeting` |
| icon/nhãn danh sách nguồn | icon micro + nhãn theo `meetingPhase` |

## 2. Bảng mới

### `meeting_session` (1–1 với `source`)

| Cột | Kiểu | Ràng buộc / ý nghĩa |
|---|---|---|
| `source_id` | TEXT | PK, FK `source(id)` ON DELETE CASCADE |
| `session_id` | TEXT | NOT NULL UNIQUE — tên thư mục `<userData>/meetings/<session_id>/`; UUID v4 do main sinh |
| `phase` | TEXT | NOT NULL CHECK IN (`recording`,`paused`,`stopping`,`finalizing`,`interrupted`,`incomplete`,`done`) |
| `ended_by_user` | INTEGER | NOT NULL DEFAULT 0 — 1 khi người dùng kết thúc (nút, xác nhận thoát, đĩa đầy tự dừng) |
| `language_mode` | TEXT | NOT NULL CHECK IN (`auto`,`vi`,`en`,`multi`) |
| `language` | TEXT | NULL — ngôn ngữ hiệu lực hiện tại (`vi`/`en`); NULL khi chưa phát hiện hoặc `multi` |
| `language_changes_json` | TEXT | NOT NULL DEFAULT `'[]'` — `[{atSec, lang, source: "auto"\|"user"}]` |
| `device_label` | TEXT | NULL — nhãn thiết bị lúc bắt đầu (chỉ hiển thị) |
| `started_at` | INTEGER | NOT NULL — epoch ms |
| `ended_at` | INTEGER | NULL |
| `duration_ms` | INTEGER | NOT NULL DEFAULT 0 — **thời lượng audio** (không tính tạm dừng) |
| `segments_json` | TEXT | NOT NULL DEFAULT `'[]'` — `[{index, file, samples, closed}]` (`file` = tên tệp tương đối, không path tuyệt đối) |
| `pause_gaps_json` | TEXT | NOT NULL DEFAULT `'[]'` — `[{atSec, wallSeconds, reason: "user"\|"deviceLost"\|"interrupted"}]` |
| `transcript_quality` | TEXT | NULL CHECK IN (`final`,`draft`) |
| `final_progress` | INTEGER | NOT NULL DEFAULT 0 — số phân đoạn đã chốt (hiển thị tiến độ) |
| `updated_at` | INTEGER | NOT NULL |

Index: `meeting_session(phase)` (khởi động tìm phiên dang dở).

### `meeting_marker`

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `id` | TEXT | PK (UUID do main sinh) |
| `source_id` | TEXT | NOT NULL FK `source(id)` ON DELETE CASCADE |
| `kind` | TEXT | NOT NULL CHECK IN (`decision`,`actionItem`,`question`) |
| `t_start` | REAL | NOT NULL ≥ 0 — giây thời gian audio |
| `t_end` | REAL | NOT NULL ≥ `t_start` (đánh dấu điểm: `t_end = t_start`) |
| `created_at` | INTEGER | NOT NULL |

Index: `meeting_marker(source_id, t_start)`. Không có cột ghi chú (D4). Không vào FTS/chunk.

### `transcript_span` (map char ↔ thời gian mức câu — D3)

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `source_id` | TEXT | NOT NULL FK `source(id)` ON DELETE CASCADE |
| `idx` | INTEGER | NOT NULL — thứ tự |
| `char_start` | INTEGER | NOT NULL — offset trong transcript chốt (văn bản đã lập chỉ mục) |
| `char_end` | INTEGER | NOT NULL > `char_start` |
| `t_start` | REAL | NOT NULL |
| `t_end` | REAL | NOT NULL ≥ `t_start` |

PK `(source_id, idx)`. Ghi một lần ở bước hoàn tất (giao dịch xoá-rồi-chèn để "Chốt lại" idempotent). Bảng mang tên chung để sau này audio/video thường có thể dùng (ngoài
phạm vi v1).

## 3. Tệp trên đĩa (`<userData>/meetings/<sessionId>/`)

| Tệp | Khi nào | Ghi chú |
|---|---|---|
| `seg-0000.wav` … | đang ghi → tới khi `ready` | PCM16 16 kHz mono; header sửa khi đóng/khôi phục (R3) |
| `session.json` | PR C1, mỗi 30 s + đóng phân đoạn | checkpoint nguyên tử (tmp→rename) — R12 |
| `draft.jsonl` | PR B | append `{id, tStart, tEnd, text, lang}` cho cửa sổ nháp **đã xong** |
| `final/seg-0000.json` … | trong hoàn tất | kết quả ASR chốt từng phân đoạn (checkpoint hoàn tất) |
| `meeting.wav` | cuối hoàn tất | tệp phát lại; sau khi có, xoá `seg-*.wav` và `final/` |

Sao lưu (085): thư mục `meetings/` được đưa vào snapshot + `VAULT_ITEMS` (R14).

## 4. Thực thể runtime (main, không lưu DB)

- **ActiveRecording** (một bản duy nhất): `{ sessionId, sourceId, ownerWebContentsId, phase, expectedSeq, segmentWriter, samplesInSegment, durationSamples,
  armedUntil, lastBatchAt, diskLevel, draftQueue, languageState }`.
- **DraftWindow**: `{ id: "w<index>", tStart, tEnd, text, pending: boolean }` — push qua `meeting:draft`.

## 5. Máy trạng thái phiên (thuần `session-state.ts`)

```text
(none) --start--> recording
recording --pause(user)--> paused            [đóng phân đoạn, mic tắt, gap(user)]
recording --deviceLost--> paused             [gap(deviceLost)]
paused --resume--> recording                 [phân đoạn mới]
recording|paused --stop(user|diskFull|quitConfirmed)--> stopping   [ended_by_user=1]
stopping --segmentsClosed--> finalizing
recording|paused --rendererGone|noAudio5s|crash--> interrupted   [ended_by_user=0]
interrupted --recover(finalize)--> finalizing
interrupted --recover(keepIncomplete)--> incomplete   [source.status=ready, 0 chunk]
interrupted --recover(discard)--> (deleted)
finalizing --ok--> done                      [source.status=ready, quality=final]
finalizing --asrFailed|noFinalModel + có nháp--> done [quality=draft]
finalizing --asrFailed + không nháp--> incomplete
incomplete|done(quality=draft) --finalizeAgain--> finalizing
```

Khởi động (`classifyOnStartup`): `stopping|finalizing` hoặc `ended_by_user=1` ⇒ tự hoàn tất; `recording|paused|interrupted` với `ended_by_user=0` ⇒ thẻ phục hồi (PR C1;
PR A ⇒ tự hoàn tất).

Ánh xạ sang `source.status`: `recording|paused|stopping|finalizing|interrupted` ⇒ `processing`; `done|incomplete` ⇒ `ready`; lỗi ghi không phục hồi được ⇒ vẫn
`processing` + phase `interrupted` (không bao giờ `error`, vì luôn còn hành động phục hồi).

## 6. Kiểm hợp lệ (main)

- `title`: trim, 1–200 ký tự.
- `notebookId`: tồn tại; không phải notebook đang bị xoá.
- `languageMode` ∈ enum; `lang` ∈ {`vi`,`en`}.
- `marker.kind` ∈ enum; `tStart`,`tEnd` hữu hạn, 0 ≤ `tStart` ≤ `tEnd` ≤ `durationSec + 1`.
- `sessionId`/`sourceId`/`markerId`: khớp định dạng UUID và thuộc phiên/nguồn `kind="meeting"`.
- Lô audio: R4.

## 7. Glossary

Thuật ngữ đã append (tag 186) trong `docs/00-glossary.md`. Tên code bám đúng: `MeetingSession`, `CaptureSegment`, `MeetingMarker`, `pauseGap`, `transcript_span`,
`languageMode`, `levelState`, `diskWarning`, `asr-worker`.
