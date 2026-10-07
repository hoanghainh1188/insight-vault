# Contract — `npm run eval:retrieval` (công cụ đo, dev-only)

Không phải IPC/API của ứng dụng. Đây là giao diện dòng lệnh dành cho người bảo trì (US4, FR-005..FR-009).

## Lệnh

```text
npm run eval:retrieval            # = vitest run -c vitest.eval.config.ts
```

## Tham số (biến môi trường — vitest không nhận flag tuỳ biến)

| Biến             | Mặc định                                          | Ý nghĩa                                                                                                                                     |
| ---------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `EVAL_MODE`      | `sweep`                                           | `sweep` = quét lưới cấu hình (R4); `current` = chỉ đo cấu hình đang dùng (`RELEVANCE_CALIBRATION.config`) + cấu hình cũ (baseline 0.5/none) |
| `EVAL_CONFIG`    | —                                                 | JSON một `RelevanceConfig` để đo riêng (ghi đè `EVAL_MODE`)                                                                                 |
| `EVAL_WITH_LLM`  | `0`                                               | `1` = thêm phần end-to-end qua Ollama cục bộ (tham khảo, R9)                                                                                |
| `EVAL_LLM_MODEL` | model chat đang chọn mặc định của Ollama đầu tiên | model cho phần LLM                                                                                                                          |
| `EVAL_CACHE_DIR` | `tests/eval/.cache/models`                        | thư mục cache mô hình e5                                                                                                                    |

## Hành vi

1. Kiểm dữ liệu (manifest, câu hỏi, MỌI trích đoạn có nguyên văn trong tài liệu) — lỗi ⇒ thoát mã ≠ 0, liệt kê lỗi.
2. Dựng thư mục tạm (`os.tmpdir()/iv-eval-*`): SQLite + LanceDB + FTS5; nạp mọi tài liệu (kể cả nhiễu) vào MỘT notebook
   qua pipeline thật; xoá thư mục tạm khi xong.
3. Với từng cấu hình: chạy `retrieve()` (cùng hàm của ứng dụng, cấu hình truyền vào) cho từng câu; tính chỉ số theo
   `dev` / `holdout` / `en`.
4. In bảng so sánh ra console; ghi `tests/eval/reports/<YYYYMMDD-HHmmss>/report.{json,md}`.
5. `reviewed = null` ⇒ in cảnh báo nổi bật, không đánh dấu cấu hình "được chọn".
6. Mã thoát: 0 khi chạy xong (không phải "đạt"); ≠ 0 khi lỗi dữ liệu/môi trường. Công cụ KHÔNG chặn PR.

## Bất biến

- Không đọc/ghi data dir người dùng; chỉ tải mô hình vào `EVAL_CACHE_DIR`.
- Không được import/đóng gói vào app (`tests/eval/**` ngoài `out/`; electron-builder chỉ gói `out/**`).
- Kết quả truy xuất tất định với cùng dữ liệu + cấu hình + mô hình.
