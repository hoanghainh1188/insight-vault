# Kết quả đo bộ chấm độ liên quan (T019–T021)

Lượt đo 2026-10-08, macOS arm64 (máy phát triển), bộ đo v3 (đã duyệt), e5-small, cấu hình 108 hiện hành làm nền; bộ chấm gắn vào ĐÚNG
`retrieve()` của app (tập ứng viên sau RRF ≤ 20 đoạn, cắt 512 token). Lưới 96 cấu hình/model, chọn trên vi dev, xác nhận vi hold-out.

## Mốc (không chấm) — xem `eval-baseline-v3.md`

vi dev 0% / 96,6% · vi hold-out 0% / 95,8% · en 0% / 68,2% (từ chối đúng / Recall@6).

## a1 — `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` (`model_qint8_arm64`, ~119 MB, Apache-2.0) — **ĐẠT**

|             | Từ chối đúng [CI95]       | Recall@6 [CI95]                       |
| ----------- | ------------------------- | ------------------------------------- |
| vi dev      | 95,5% (21/22) [78–99]     | 89,7% [79–95]                         |
| vi hold-out | **100% (10/10)** [72–100] | **95,8%** [80–99]                     |
| en          | 66,7% (8/12) [39–86]      | 72,7% [52–87] (mốc 68,2% ⇒ không tụt) |

- Cấu hình chọn: **`minScore` 0,6**, không ngưỡng tương đối, không sắp lại (24 cấu hình đạt trên dev; Δ/sắp lại không đổi số liệu ⇒ chọn đơn giản
  nhất). Cận dưới Wilson từ chối đúng vi gộp: **84,3%** (31/32) ≥ 0,75.
- Đường đánh đổi: `minScore` 0,4 ⇒ từ chối đúng dev 86,4% / Recall@6 96,6%; 0,6 ⇒ 95,5% / 89,7%.
- Độ trễ chấm/câu (hai lượt): p50 **419–504 ms**, p95 **720–1146 ms** (vượt mốc khởi đầu 300 ms); nạp model 0,6–1,9 s (đã có cache).
  RSS tăng ~ +200–440 MB khi nạp (dao động do GC).
- Event loop: đo trực tiếp (script riêng, 20 đoạn × 512 token): suy luận ONNX **bất đồng bộ**, chỉ phần tách từ chặn 26–67 ms. Trong công cụ đo
  (khoảng hở lớn nhất qua ~150 lượt) có 1 lần 649 ms — nhiều khả năng do GC; số 1,5 s ở lượt đo đầu là lỗi cách đo (đã sửa).
- Chênh lệch vi−en của cấu hình chọn: từ chối đúng 33,3 điểm, Recall@6 23,1 điểm — nhưng English **tốt hơn mốc** ở cả hai chỉ số (0% → 66,7%;
  68,2% → 72,7%).

## a2 — `onnx-community/gte-multilingual-reranker-base` (q8, ~341 MB, Apache-2.0) — **KHÔNG ĐẠT**

- vi: chọn `minScore` 0,6 Δ0,4 ⇒ dev 95,5% / 94,8%, hold-out 100% / 95,8% (tiếng Việt tốt hơn a1 một chút về Recall@6).
- **English sụp:** Recall@6 31,8% (mốc 68,2%) — loại theo sàn "English không tụt" (clarify #4). Với `minScore` 0,7: English Recall@6 9,1%.
- Độ trễ: p50 1167 ms, p95 13,9 s — quá chậm.

## Hướng b, c

Không chạy: a1 đạt cổng (T022 chỉ khi a1 và a2 cùng không đạt).

## Đề xuất (T021) — chờ chủ dự án chốt ở cổng T023

Chọn **a1, `minScore` 0,6**. Hai điểm cần quyết:

1. **Độ trễ** p50 ~0,4–0,5 s/câu (mốc 300 ms): chấp nhận và chốt ngân sách mới, hoặc giảm chi phí (vd chỉ chấm top-12 ứng viên / cắt 256 token)
   rồi đo lại.
2. **Ngưỡng chung vi/en** (FR-011): English kém vi ~33 điểm từ chối đúng nhưng vẫn tốt hơn mốc ⇒ đề xuất giữ ngưỡng chung, ghi giới hạn đã biết.
