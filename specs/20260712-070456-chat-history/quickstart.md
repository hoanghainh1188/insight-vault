# Quickstart — Chat history (027)

## Chạy

```bash
npm run dev
npm run test       # unit — chat-repo (saveTurn/list/clear/cascade) + whitelist
npm run test:e2e   # e2e — chat-history.spec + GIỮ mọi spec cũ xanh
npm run lint && npm run build
```

## Kịch bản (map SC)

1. **Persist qua đổi notebook (US1 · SC-001, SC-002)**: hỏi 1–2 câu ở notebook A → sang B → về A → thấy lại
   lượt cũ + chip `[n]` mở đúng đoạn. Khởi động lại app → vẫn còn.
2. **Multi-turn dùng lịch sử (US2 · SC-005)**: mở notebook có lịch sử → hỏi tiếp tham chiếu lượt trước → trả
   lời hợp ngữ cảnh.
3. **Xoá hội thoại (US3 · SC-003)**: bấm "Xoá hội thoại" → khung chat rỗng; mở lại vẫn rỗng.
4. **Cascade (SC-004)**: xoá notebook → unit `chat-repo` cascade (`:memory:` #1→#4) → 0 hàng còn lại.
5. **Answer lỗi không lưu (edge)**: runtime lỗi → answer lỗi → mở lại notebook KHÔNG thấy lượt mồ côi.
6. **Local-first & không hồi quy (SC-005, SC-006)**: `no-egress.spec` xanh; mọi e2e cũ xanh; không log nội
   dung.

## Done When

- [ ] Unit: chat-repo (saveTurn/list/clear/cascade khứ hồi citations) + whitelist. Coverage ≥80%.
- [ ] e2e: chat-history.spec + toàn bộ spec cũ xanh (SC-005).
- [ ] `npm run lint && npm run build` xanh. Migration #4 (user_version 3→4) idempotent.
