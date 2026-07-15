# Studio balanced context — chia đều ngân sách theo nguồn (#65)

- Ngày: 2026-07-15
- Feature: `065-studio-balanced-context` (bug fix cho `021-studio`)
- Issue: [#65](https://github.com/hoanghainh1188/insight-vault/issues/65)
- Người quyết định: hoanghainh1188 (2026-07-15)
- **Cập nhật (supersede) §1** của [2026-07-11-studio-context-strategy.md](./2026-07-11-studio-context-strategy.md).
  Giữ nguyên §2 (citation `[n]` — hậu kiểm) và §3 (system prompt theo loại).

## Bối cảnh

Người dùng báo: bấm **Tóm tắt tài liệu** trên notebook nhiều nguồn → bản tóm tắt thiên về **một** tài
liệu, không trải đều mọi nguồn (kèm chip `[n]` inline hay vắng). Điều tra: chiến lược cũ (§1 ADR
2026-07-11) gom chunk **tuần tự** theo `source.created_at` rồi `buildContext` nhồi **từ đầu** tới khi đầy
`STUDIO_CONTEXT_BUDGET` (16000, đã nới ở 025) và **bỏ nguyên phần đuôi**. Không có cơ chế chia đều ngân
sách theo nguồn → nguồn đứng trước/đủ dài chiếm hết chỗ; nguồn còn lại vắng mặt khỏi context.

## Quyết định

### 1. Gom context: ROUND-ROBIN chia đều theo nguồn (thay ALL-CHUNKS tuần tự)

- Hàm thuần mới `src/main/services/studio/balanced-context.ts` → `buildBalancedContext(groups, budget)`.
  `groups` = mỗi nguồn 1 mảng chunk (theo `ordinal`).
- **Vòng 0** nhận chunk ĐẦU của **MỌI** nguồn **vô điều kiện** (bỏ qua ngân sách) → BẢO ĐẢM mỗi nguồn
  góp ít nhất 1 đoạn, kể cả khi nguồn đầu có chunk quá khổ. **Vòng ≥1** lấy chunk kế của từng nguồn, chỉ
  nhận khi còn ngân sách; bỏ NGUYÊN chunk vượt (không cắt giữa → locator không lệch).
- Xen kẽ nguồn cũng phân tán vị trí trong prompt → giảm recency bias của model local.
- **Trade-off**: vòng 0 có thể vượt `budget` một chút khi rất nhiều nguồn; chấp nhận được vì notebook
  thực tế ít nguồn, đổi lại không nguồn nào bị bỏ trắng (đúng mục tiêu người dùng).
- `truncated = map.size < tổng số chunk` (khớp UI ghi chú "dựa trên một phần mỗi nguồn").

### 2. Tăng tuân thủ chip `[n]` (prompt.ts)

- System prompt ép: mỗi ý **BẮT BUỘC** kết thúc bằng ≥1 chip `[n]` (kèm ví dụ) + yêu cầu bao quát **TẤT
  CẢ** nguồn. Chỉ là ràng buộc câu chữ gửi model local — **không** đảm bảo tuân thủ; tầng hậu kiểm
  `postprocessCitations` + fallback `citationsFromMap` (§2 ADR cũ) vẫn giữ Constitution II bất kể model
  có nghe lời hay không.

## Hệ quả

- `context-builder.ts` export `citationBlock` (dùng chung định dạng khối `[n]`). `buildContext` (RAG
  chat) **giữ nguyên hành vi** — không hồi quy.
- Test-first: `tests/unit/balanced-context.test.ts` (8 case: interleave, cắt công bằng, regression #65
  nguồn đầu quá khổ, nhóm không đều, locator giữ nguyên) + mở rộng `studio-prompt.test.ts`.
- Không đổi schema, IPC, hay UI luồng (chỉ đổi copy ghi chú truncated).

## Ngoài phạm vi

Map-reduce theo nguồn (đã cân nhắc, chọn round-robin 1-lượt để giữ chip `[n]` chính xác tuyệt đối — xem
[2026-07-11-studio-mapreduce-citation.md](./2026-07-11-studio-mapreduce-citation.md) đã BÁC trước đó).
