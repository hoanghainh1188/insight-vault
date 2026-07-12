# Feature Specification: Audio transcription + trích dẫn (Pha 2a-core)

**Feature Branch**: `045-audio-transcribe` · **Created**: 2026-07-12 · **Status**: Draft

**Input**: Nạp file audio → bóc băng (Whisper local) → hỏi đáp có trích dẫn (RAG). Quyết định:
`docs/04-decisions/2026-07-12-audio-transcribe-clarify.md`.

## Clarifications (2026-07-12)

- Engine: transformers.js Whisper `Xenova/whisper-base`, chạy LOCAL ở main; model tải 1 lần về data dir.
- Chỉ **audio** (wav/mp3/flac/ogg); m4a/aac→2b, video→2b, ảnh→2c.
- Timestamp: `Locator`+`tStart/tEnd`; chunk theo char + gắn timestamp qua `timeMap`.
- **2a-core**: transcribe→RAG→chip `[n]` mở transcript trong Source Viewer sẵn có. **2a-player** (audio
  player + seek) = PR sau.

## User Scenarios

### US1 — Nạp audio & hỏi đáp (P1)

Người dùng kéo file audio vào → app bóc băng cục bộ (hiện tiến độ tải model + xử lý) → hỏi được về nội dung,
câu trả lời có chip `[n]` mở đúng đoạn transcript.

- **Test**: nạp .mp3 → trạng thái "đang xử lý" (parse/bóc băng) → "Sẵn sàng"; hỏi → chip mở transcript.

### US2 — Local & riêng tư (P1)

Bóc băng chạy trên máy — audio KHÔNG rời máy. Chỉ model Whisper tải từ HF 1 lần.

- **Test**: nạp audio khi offline (đã có model) → vẫn bóc băng; không có audio gửi ra ngoài.

### Edge Cases

- File audio hỏng/không giải mã → lỗi rõ, nguồn = error (retry được).
- Audio dài → tiến độ (tải model + transcribe) qua thanh 037.
- m4a/video → không hỗ trợ (báo định dạng).

## Requirements

- **FR-001**: Hỗ trợ nạp audio wav/mp3/flac/ogg; bóc băng bằng Whisper LOCAL ở main.
- **FR-002**: Transcript → chunk theo char (tái dùng chunker) + gắn tStart/tEnd mỗi chunk (từ timeMap).
- **FR-003**: RAG + chip `[n]` hoạt động trên nguồn audio (transcript = text; viewer sẵn có highlight).
- **FR-004**: Audio KHÔNG rời máy (transcribe local); chỉ model tải 1 lần về data dir; tiến độ hiển thị.
- **FR-005**: Đọc file + inference CHỈ main; KHÔNG log nội dung transcript/audio (Constitution III).
- **FR-006**: `Locator`+`tStart/tEnd` (backward-compat); persist qua migration #5 (chunk cột t_start/t_end).
- **FR-007**: KHÔNG phá vỡ pipeline pdf/docx/txt/url; parser cũ không đổi hành vi.

## Success Criteria

- **SC-001**: Nạp audio → bóc băng → hỏi đáp có chip `[n]` mở transcript. (Đã verify E2E: jfk.wav→transcript.)
- **SC-002**: Audio không egress; chỉ model download. **SC-003**: 0 hồi quy các loại nguồn cũ + RAG.
- **SC-004**: Timestamp lưu đúng (test migration + timeForCharRange).

## Assumptions

- transformers.js chạy ở Node/Electron main (đã có onnxruntime từ lancedb). audio-decode giải mã wav/mp3/
  flac/ogg. resample + buildTranscript thuần. cleanText giữ char-offset (buildTranscript chuẩn hoá whitespace).

## Out of Scope

Audio player + seek (2a-player) · video/ffmpeg (2b) · ảnh (2c) · m4a/aac · streaming transcription · sửa model.
