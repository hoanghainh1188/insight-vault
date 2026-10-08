# Mốc trên bộ đo v3 (T018)

Lượt đo 2026-10-08, `EVAL_MODE=current npm run eval:retrieval`, e5-small, macOS arm64. Cấu hình 108 hiện hành (vector ≤ 0,5, không chặn
BM25, không bộ chấm). Bộ đo v3: vi 82 câu có đáp án + 32 không có (dev 22 / hold-out 10); en 22 + 12.

| Nhóm        | Từ chối đúng [CI95] | Recall@6 [CI95] |
| ----------- | ------------------- | --------------- |
| vi dev      | 0,0% [0–15]         | 96,6% [88–99]   |
| vi hold-out | 0,0% [0–28]         | 95,8% [80–99]   |
| en          | 0,0% [0–24]         | 68,2% [47–84]   |

- Hồi quy: "✓ Khớp số liệu ghi trong RELEVANCE_CALIBRATION" (Recall/MRR các câu có đáp án không đổi vì v3 chỉ thêm câu không có đáp án).
- Tầng truy xuất hiện **không chặn được câu nào** không có đáp án (0%) — đúng như 108 ghi nhận.
