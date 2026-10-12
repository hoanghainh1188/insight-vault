# Bộ chấm độ liên quan — câu sát chủ đề và đoạn bảng — clarify (187)

- Ngày: 2026-10-12
- Feature: `187-reranker-near-topic` (issue #187). Spec: `specs/20261012-120856-reranker-near-topic/spec.md`. Intake:
  `docs/intake/187-reranker-near-topic.md`. Kế thừa: 108 (relevance calibration), 109 (unanswerable detection), 177 (eval PDF).

## Chốt ở `/speckit-specify`

1. **Phạm vi giải pháp hai bước:** đổi cấu hình bộ chấm hiện có trước (ngưỡng, ngưỡng tương đối, số ứng viên, độ dài cắt — có thể mở rộng lưới);
   chỉ khi không đạt mới đánh giá model khác (cục bộ, cho phép thương mại, ONNX, ghim phiên bản).
2. **Đổi cách đưa đoạn bảng vào bộ chấm** (vd gắn tiêu đề cột, chỉ cho bước chấm) CHỈ khi bước chẩn đoán xác nhận đoạn bảng bị chấm thấp;
   chunk / locator / chip `[n]` giữ nguyên.
3. **Không giải pháp nào đạt** ⇒ giữ cấu hình hiện hành, ADR "giới hạn đã biết" kèm số liệu, giữ #187 mở, tách issue mới cho hướng tiếp.

## Chốt ở `/speckit-clarify`

1. **Chống học vẹt:** chọn trên dev bằng `chooseRerankConfig`; q-162, q-170, q-171 là **bộ kiểm hồi quy đáp án-trong-bảng** — cấu hình làm
   một câu trong đó bị từ chối ⇒ loại; không dùng để xếp hạng / chọn (hold-out giữ độc lập).
2. **Bộ câu hỏi v5 làm TRƯỚC ở PR riêng:** ~2 câu không đáp án sát chủ đề cho mỗi tài liệu thật (~20 câu, tiếng Việt, 70/30) + 2–3 câu có
   đáp án trong bảng nếu tài liệu có bảng; `datasetVersion` "5", chủ dự án duyệt rồi mới quét. Số liệu v4 là mốc "trước".
3. **Ngân sách:** giữ 109 (p50 ≤ 400 ms, p95 ≤ 800 ms, macOS arm64 tham chiếu) — cấu hình vượt bị loại; nếu đổi model: tải ≤ 150 MB, RAM tăng
   ≤ 200 MB, ONNX int8.
4. **Tiếng Anh:** ngưỡng chung vi/en; tiếng Anh là điều kiện chặn (không thấp hơn Recall@6 72,7% / từ chối đúng 83,3% hiện hành); không
   thêm câu tiếng Anh ở v5; tách ngưỡng theo ngôn ngữ ngoài phạm vi.
5. **Chia PR:** PR 1 = v5 + công cụ chẩn đoán (điểm bộ chấm từng câu khi `EVAL_DETAILS=1`) + báo cáo chẩn đoán, không đổi mã chạy app; PR 2
   = thay đổi cấu hình / model / cách đưa bảng + đo lại `RELEVANCE_CALIBRATION` + ADR thực thi + bảng trước/sau so với v4.

## Mặc định (đề xuất, có thể đổi trước `/speckit-plan`)

- **B1 thước đo bắt buộc:** FR-003 (từ chối đúng dev ≥ 90% trên v5, gồm q-176, q-179), FR-004 (bộ kiểm bảng không bị từ chối), FR-005
  (cổng R6 ĐẠT + không câu hiện có nào tụt theo đường app, so từng câu), ngân sách (FR-008), điều kiện tiếng Anh.
- **B6 tín hiệu bổ sung** (vd kết hợp điểm vector với điểm bộ chấm): chỉ xét ở bước 2 cùng việc đánh giá model, sau chẩn đoán.
