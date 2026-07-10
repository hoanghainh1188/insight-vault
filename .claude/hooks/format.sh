#!/usr/bin/env bash
# Format-on-save hook — chạy sau mỗi Write/Edit (PostToolUse) để format file vừa sửa.
# Được gọi từ .claude/settings.json: `bash .claude/hooks/format.sh`.
#
# ─────────────────────────────────────────────────────────────────────────────
# CÁCH BẬT (điền theo tech stack của dự án, rồi bỏ dòng `exit 0` mặc định bên dưới):
#
#   Claude Code truyền payload JSON qua STDIN; đường dẫn file vừa sửa nằm ở
#   `.tool_input.file_path`. Ví dụ lấy path (cần `jq`):
#     FILE=$(cat | jq -r '.tool_input.file_path // empty')
#
#   Rồi gọi formatter repo-local theo stack (ưu tiên tooling trong repo,
#   KHÔNG chạy package remote một lần — xem web/hooks.md):
#     TS/JS/web : [ -n "$FILE" ] && npx --no-install prettier --write "$FILE"
#     Go        : [ -n "$FILE" ] && gofmt -w "$FILE"
#     Python    : [ -n "$FILE" ] && python -m black "$FILE"
#     Java      : [ -n "$FILE" ] && ./gradlew spotlessApply    # hoặc google-java-format
#
#   Thứ tự chuẩn của toàn bộ chuỗi chất lượng: format → lint → type check → build.
#   (format tự chạy ở đây; lint/test/build chạy ở Test gate của /design-to-code.)
# ─────────────────────────────────────────────────────────────────────────────
#
# ─────────────────────────────────────────────────────────────────────────────
# Đã cấu hình cho stack InsightVault (TS/React qua Prettier repo-local).
# Chỉ format file mã nguồn TS/JS/TSX/CSS/JSON/MD; bỏ qua file khác. Không fail hook nếu
# prettier chưa cài (|| true) để không chặn Edit/Write khi đang setup.
FILE=$(cat | jq -r '.tool_input.file_path // empty' 2>/dev/null)
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.cjs|*.mjs|*.css|*.json|*.md)
    [ -n "$FILE" ] && [ -f "$FILE" ] && npx --no-install prettier --write "$FILE" >/dev/null 2>&1 || true
    ;;
esac
# Lint --fix cho file TS/JS (sau format). Không fail hook nếu eslint chưa cài / có lỗi (|| true).
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.cjs|*.mjs)
    [ -n "$FILE" ] && [ -f "$FILE" ] && npx --no-install eslint --fix "$FILE" >/dev/null 2>&1 || true
    ;;
esac
exit 0
