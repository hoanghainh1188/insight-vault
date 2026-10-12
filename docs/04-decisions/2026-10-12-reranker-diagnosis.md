# Chẩn đoán bộ chấm độ liên quan — câu sát chủ đề và đoạn bảng (187, PR 1)

- Ngày: 2026-10-12
- Feature: `187-reranker-near-topic` (issue #187). Clarify: `2026-10-12-reranker-near-topic-clarify.md`. Spec:
  `specs/20261012-120856-reranker-near-topic/`.
- Phạm vi PR 1: công cụ chẩn đoán + bộ câu hỏi v5 + số liệu v5 của cấu hình hiện hành. **Không đổi hành vi app** (cấu hình 108 / 109
  giữ nguyên). PR 2 (đổi cấu hình / cách đưa bảng / model) chỉ bắt đầu sau khi chủ dự án duyệt v5.

## Đã làm

1. **Ghi điểm mọi ứng viên** (`EVAL_DETAILS=1`): harness bọc hàm chấm trên đường app (cấu hình 108 + bộ chấm đã ghi) ⇒
   `details.production[].rerankCandidates` (`chunkId`, `source`, `score`, `hit`, `quoteInWindow`) — kể cả câu bị từ chối (vốn không có
   `rerankScore`). Ghi theo từng câu (đặt lại trước mỗi câu); câu không được chấm ⇒ không gắn ứng viên. Đã so `details.production`
   (`rejected`, `hitRank` từng câu) của lượt có ghi với mốc T002 (v4) và lượt v5 trước / sau sửa review: trùng hệt ⇒ việc ghi không đổi
   hành vi.
2. **Cửa sổ token**: scorer lộ `windowText(query, passage)` — giải mã phần ĐOẠN còn lại sau khi tokenizer cắt cặp ở `maxTokens` (cùng
   tokenizer, cùng `max_length`). Kiểm tay: cặp ngắn giữ nguyên; đoạn bảng Tuyến 2A 1.456 ký tự ⇒ còn 530 ký tự.
3. **Chẩn đoán** (`tests/eval/lib/rerank-diagnose.ts`, hàm thuần có test): nguyên nhân từng câu `cutOff` / `lowScoreInWindow` /
   `rankedOut` (đủ điểm, trong cửa sổ mà vẫn rơi khỏi top 6 — thêm sau review) / `nearTopicHighScore` / `notRetrieved` / `ok`; mục "Chẩn đoán bộ chấm" trong report.md (chỉ id / điểm, không nội dung đoạn).
4. **Bộ câu hỏi v5** (`datasetVersion` 4 → **5**, `reviewed: null`): +20 câu không đáp án **sát chủ đề** (2 / tài liệu thật, trường mới
   `topicDocId`; 4 câu về PDF giữ `topic: "pdf"`; dev / hold-out 13 / 7) + 3 câu có đáp án nằm trong dòng bảng (q-184 bảng phí thuê kho,
   q-185 / q-186 hộp thông tin Tuyến 2A; dev / hold-out 2 / 1). Toàn tiếng Việt; câu v4 không đổi. Mỗi câu không đáp án đã kiểm bằng
   từ khoá + đồng nghĩa trên văn bản khi nạp (`.md` / `parsePdf`).
5. **`RELEVANCE_CALIBRATION`**: chỉ số liệu đo lại trên v5 + `datasetVersion` "5"; cấu hình, `maxTokens`, độ trễ ghi không đổi.

## Chẩn đoán trên v4 (mốc, cấu hình hiện hành: `minScore` 0,6 · 12 ứng viên · 256 token)

| Câu   | Vai trò                   | Nguyên nhân        | Điểm cao nhất | Điểm đoạn đúng | Hạng RRF đoạn đúng | Đáp án trong cửa sổ |
| ----- | ------------------------- | ------------------ | ------------- | -------------- | ------------------ | ------------------- |
| q-162 | bảng nhà ga (hold-out)    | lowScoreInWindow   | 0,122         | 0,122          | 3                  | có                  |
| q-170 | bảng phí kho (hold-out)   | ok                 | 0,984         | 0,984          | 1                  | có                  |
| q-171 | bảng phí kho (dev)        | ok                 | 0,986         | 0,986          | 1                  | có                  |
| q-176 | sát chủ đề PDF (dev)      | nearTopicHighScore | 0,826         | —              | —                  | —                   |
| q-179 | sát chủ đề PDF (dev)      | nearTopicHighScore | 0,860         | —              | —                  | —                   |
| q-089 | không đáp án cũ lọt (dev) | nearTopicHighScore | 0,926         | —              | —                  | —                   |
| q-090 | không đáp án cũ lọt (dev) | nearTopicHighScore | 0,622         | —              | —                  | —                   |

Tổng v4: `cutOff` 0 · `lowScoreInWindow` 5 · `rankedOut` 0 · `nearTopicHighScore` 6 · `notRetrieved` 8 (câu có đáp án vi bị từ chối: q-043 0,242,
q-060 0,551, q-073 0,443, q-076 0,147; `notRetrieved` chủ yếu tiếng Anh — đáp án không vào 12 ứng viên đầu).

## Số liệu v5 — cấu hình hiện hành (mốc "trước" cho PR 2)

| Nhóm                    | n có / không đáp án | R@6   | MRR   | Từ chối đúng | Từ chối nhầm |
| ----------------------- | ------------------- | ----- | ----- | ------------ | ------------ |
| 108 (không bộ chấm) dev | 78 / 41             | 97,4% | 0,851 | 0%           | 0%           |
| 108 hold-out            | 34 / 19             | 97,1% | 0,878 | 0%           | 0%           |
| + bộ chấm dev           | 78 / 41             | 93,6% | 0,848 | **87,8%**    | 6,4%         |
| + bộ chấm hold-out      | 34 / 19             | 91,2% | 0,882 | **84,2%**    | 5,9%         |
| + bộ chấm English       | 22 / 12             | 72,7% | 0,640 | 83,3%        | 9,1%         |

- Câu mới: 16 / 20 câu sát chủ đề bị từ chối đúng; lọt **q-188** (0,776), **q-198** (0,673), **q-204** (0,997), **q-206** (0,921).
  Câu bảng: q-184 / q-186 giữ, hạng 1 (0,986 / 0,994); **q-185 bị từ chối** (`lowScoreInWindow`, đoạn đúng 0,229, trong cửa sổ).
- Cổng `gateVerdict` của cấu hình hiện hành **trên v5: KHÔNG ĐẠT** (từ chối đúng hold-out 84,2% < 90%; cận dưới Wilson vi gộp 52/60
  ≈ 75,8% ≥ 0,75; English bằng mốc). Đây là hệ quả của bộ đo khó hơn (v4: 100% hold-out), không phải hồi quy của app.
- **Sàn tiếng Anh cho PR 2** (clarify #4): R@6 ≥ 72,7%, từ chối đúng ≥ 83,3% — trùng số dự kiến.

## Kết luận

1. **Không phải cắt cửa sổ token.** `cutOff` = 0 trên cả v4 và v5: đáp án của q-162 / q-185 vẫn nằm trong 256 token đầu, nhưng bộ chấm
   cho điểm thấp (0,12–0,23). Giả thuyết "dòng đáp án bị cắt" của plan **bị bác** ⇒ theo điều kiện của tasks, T019–T021 (`rerankInput`)
   mặc định "không cần".
2. **Vấn đề nằm ở model chấm** theo hai chiều ngược nhau: đoạn bảng "bẩn" của PDF Wikipedia (hộp thông tin trộn thân bài, nhiều cột)
   bị chấm rất thấp, còn bảng sạch của hợp đồng kho được chấm ~0,99; câu sát chủ đề được chấm rất cao (q-204 0,997, q-206 0,921, q-089
   0,926). Không ngưỡng `minScore` đơn lẻ nào tách được 0,12 (đúng) với 0,997 (sai) ⇒ bước 1 (lưới cấu hình) khó đạt cả FR-003 lẫn bộ
   kiểm bảng; nhiều khả năng cần bước 2 (model khác) — PR 2 đo để kết luận, không suy.
3. **Điểm mở cho PR 2** (chủ dự án quyết khi bắt đầu PR 2): hai câu bảng bị từ chối đều thuộc bảng "bẩn" của PDF Wikipedia — trình bày
   lại đoạn bảng cho bộ chấm (giữ dòng tiêu đề + dòng trùng từ khoá) có thể nâng điểm dù không phải `cutOff`. Điều kiện hiện tại của
   T019 chỉ cho làm khi `cutOff` là nguyên nhân chính ⇒ muốn thử phải đổi điều kiện (ghi vào clarify / ADR của PR 2).

Tổng v5: `cutOff` 0 · `lowScoreInWindow` 6 · `rankedOut` 0 · `nearTopicHighScore` 10 · `notRetrieved` 8.

## Hệ quả

- Báo cáo mặc định (không `EVAL_DETAILS`) không đổi; `npm test` không cần mô hình (chẩn đoán / v5 kiểm bằng hàm thuần + tệp thật).
- PR 2 so từng câu với số liệu v5 ở trên (FR-005), loại cấu hình làm q-162 / q-170 / q-171 bị từ chối hoặc đoạn đúng ngoài top 6.
  Câu bảng v5 (q-184…q-186) **không** thuộc bộ kiểm hồi quy bảng — chỉ so từng câu như mọi câu khác (q-185 hiện đã bị từ chối).
- Glossary: các dòng cũ còn ghi "v4" (bộ đánh giá, bản ghi hiệu chuẩn, cấu hình mốc) — sửa ở PR glossary riêng (rule 5) sau khi PR 1
  merge.
