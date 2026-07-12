# Implementation Plan: Chat history (lưu lịch sử hội thoại theo notebook)

**Branch**: `027-chat-history` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/20260712-070456-chat-history/spec.md`

## Summary

Lưu bền hội thoại Chat theo notebook (kế thừa 013). **Migration #4** bảng `chat_message` (FK cascade). Persist
cặp user+assistant ở MAIN sau khi `rag:ask` sinh xong (best-effort, không phá answer nếu DB lỗi; answer lỗi
→ không lưu). Nạp lịch sử khi mở notebook (`chat:history`) → `useChat` hiển thị lại + dùng multi-turn. Nút
"Xoá hội thoại" (`chat:clear`). KHÔNG log nội dung.

## Technical Context

**Language/Version**: TS 5, Node 24 (Electron main + vitest), React 18.

**Primary Dependencies**: KHÔNG thêm. Tái dùng migration runner + FK cascade (011), rag-service (013),
Citation/Locator (013), useChat (013). `node:sqlite`.

**Storage**: **Migration #4** `chat_message` (user_version 3→4, append-only).

**Testing**: Vitest (unit — `chat-repo` `:memory:` migration #1→#4: saveTurn/list/clear/cascade; whitelist).
Playwright `_electron` (e2e — hội thoại persist qua đổi notebook/reload; xoá; GIỮ e2e cũ xanh SC-005).

**Target Platform**: Desktop offline-first (SQLite local, không egress).

**Project Type**: Desktop app (Electron main/preload/renderer) — D6.

**Constraints**: Constitution I (SQLite local, không egress); II (lưu citations giữ kiểm-chứng-được — chip
nạp lại mở đúng đoạn); III (đọc/ghi DB CHỈ ở main; renderer qua `chat:*` whitelisted; KHÔNG log nội dung);
IV coverage ≥80%.

**Scale/Scope**: 1 migration, 2 kênh IPC mới (`chat:history`, `chat:clear`), 1 repo mới (`chat-repo`), sửa
`rag-service` (dep saveTurn + persist), `useChat` (nạp/xoá). KHÔNG đổi luồng retrieval/citation.

## Constitution Check

_GATE: pass trước Phase 0._

| Principle                                       | Cách tuân thủ                                                                                                 | Trạng thái |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------- |
| I. Local-first & No Egress                      | Lưu/nạp SQLite local; không thêm mạng.                                                                        | ✅ PASS    |
| II. Verifiable Citations (NON-NEGOTIABLE)       | Lưu `citations_json` (kèm locator) → chip nạp lại mở đúng đoạn. Không đổi logic citation.                     | ✅ PASS    |
| III. Desktop Security Boundary (NON-NEGOTIABLE) | Đọc/ghi DB CHỈ ở main; renderer qua `chat:history`/`chat:clear` whitelisted (safeHandle). KHÔNG log nội dung. | ✅ PASS    |
| IV. Test-First & Coverage                       | Unit `chat-repo` (saveTurn/list/clear/cascade) + whitelist. Coverage ≥80%; exclude wiring.                    | ✅ PASS    |
| V. Phased Delivery                              | Bước sau 013/021/023/025. Migration #4 append-only.                                                           | ✅ PASS    |

**GATE PASS.** Persist best-effort (DB lỗi không phá answer); answer lỗi → không lưu (ask throw trước persist).

## Project Structure

```text
src/
├── shared/ipc/
│   ├── types.ts             # THÊM StoredChatMessage{role,content,citations,notFound,createdAt}
│   └── channels.ts          # THÊM chat:history + chat:clear + ChannelResponse
├── main/
│   ├── db/migrations.ts     # THÊM migration #4: bảng chat_message (user_version 3→4)
│   ├── services/rag/
│   │   ├── chat-repo.ts         # MỚI THUẦN/DI: saveTurn / listByNotebook / clear + (de)serialize citations
│   │   └── rag-service.ts       # THÊM dep saveTurn; ask persist sau khi có answer (best-effort, không log)
│   ├── ipc/register.ts      # THÊM safeHandle chat:history + chat:clear (không log content)
│   └── index.ts             # wire chat-repo vào rag-service (saveTurn) + register
├── preload/index.ts         # THÊM chatHistory(notebookId) + chatClear(notebookId)
└── renderer/features/rag-qa/
    ├── useChat.ts           # nạp chat:history khi đổi notebook (thay reset []); clearHistory()
    └── ChatColumn.tsx       # nút "Xoá hội thoại" (khi có lịch sử)

tests/
├── unit/  chat-repo.test.ts · chat-channels-whitelist.test.ts
└── e2e/   chat-history.spec.ts (persist qua đổi notebook · xoá · whitelist)
```

**Structure Decision**: `chat-repo` (thuần/DI, test `:memory:`) như `studio-repo` (021). `rag-service`
persist là side-effect best-effort. `useChat` đổi điểm nạp (từ `[]` → `chat:history`). Migration #4 độc lập.
Không đụng retrieval/citation/context-builder.

## Complexity Tracking

> Migration #4 độc lập (bảng mới). Persist ở main tránh round-trip renderer + giữ nguồn sự thật 1 nơi.
> Không thêm dependency. Không cần biện minh.
