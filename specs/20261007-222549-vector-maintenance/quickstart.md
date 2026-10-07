# Quickstart — kiểm chứng 116 vector-maintenance

## Tự động (test gate)

```bash
npm run lint
npm test            # gồm unit schedule/maintenance/track-writes + integration LanceDB thật (vector-store-optimize)
npm run build
npm run test:e2e
EVAL_MODE=current npm run eval:retrieval   # phải in "hồi quy OK"
```

Kỳ vọng:

- `tests/unit/vector-maintenance-schedule.test.ts` — debounce 60 s, trần 10 phút, cổng ngưỡng 64 fragment / 20 phiên
  bản, `lowDisk`, backoff 10→20 phút, ngưng sau 3 lỗi, follow-up sau biên.
- `tests/unit/vector-maintenance.test.ts` — single-flight, bận ⇒ hoãn, không ném, `whenIdle` + timeout, log không có
  khoá ngoài danh sách (C4).
- `tests/unit/vector-store-optimize.test.ts` — LanceDB thật trên `mkdtemp`: nhiều lô `add` + `delete` ⇒ `stats` thấy
  nhiều fragment; `optimize(0)` ⇒ còn 1 fragment, `dirSize` giảm, `search`/`countBy*`/`getVectorsByIds` giống hệt;
  ghi đồng thời trong lúc `optimize` vẫn đúng; bảng chưa có ⇒ `null`.
- `tests/unit/vault-backup-*.test.ts` — `waitVectorIdle` trả `false` ⇒ `busy`, không chụp.

## Thủ công (app thật)

1. `npm run dev`, nạp một PDF/TXT vài trăm đoạn, xoá một nguồn.
2. Đợi ~1 phút sau thao tác cuối ⇒ `main.log` có `vector.maintenance.start` rồi `vector.maintenance.done` với
   `fragmentsAfter` nhỏ (thường 1), `trigger: "write"`.
3. Đợi thêm ~11 phút ⇒ một lần `done` với `trigger: "followUp"`, `bytesFreed > 0`, `versionsRemoved > 0`.
4. Mở lại app ⇒ sau ~45 s có kiểm `trigger: "startup"` (thường `skip` `belowThreshold` nếu kho đã gọn).
5. Bắt đầu sao lưu ngay khi thấy `vector.maintenance.start` ⇒ sao lưu vẫn thành công (chờ bảo trì xong).
6. Kiểm `main.log`: không có đường dẫn hay nội dung tài liệu trong các dòng `vector.maintenance.*`.
