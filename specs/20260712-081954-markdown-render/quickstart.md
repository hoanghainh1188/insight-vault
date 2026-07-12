# Quickstart — Markdown render (029)

```bash
npm run dev · npm run test (unit parser) · npm run test:e2e · npm run lint && npm run build
```

## Kịch bản (map SC)
1. Markdown render (US1·SC-001): câu trả lời/kết quả có **đậm**/`#`/`- `/```` ``` ```` → hiển thị đúng, hết ký tự thô.
2. Chip trong markdown (US2·SC-002): `[n]` giữa markdown → chip bấm mở đúng nguồn; `[n]` trong code → literal.
3. An toàn (US3·SC-003,SC-004): `<script>`/HTML thô → không thực thi; 0 request ngoài (no-egress xanh).
4. Không hồi quy (SC-005): e2e chip cũ (rag-qa/studio/source-viewer/ui-polish) xanh.

## Done When
- [ ] Unit parser (block/inline/chip-không-trong-code/an-toàn) ≥80%. e2e markdown + spec cũ xanh.
- [ ] lint/build xanh. Không dependency/IPC/DB mới.
