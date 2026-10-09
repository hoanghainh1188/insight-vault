import type { SourceProgressEvent, SourceStatus } from "@shared/ipc/types";
import { createTranslator, type Translator } from "@shared/i18n";
import { normalizeSourceErrorCode } from "@shared/codes/source-error";

// 091 — câu thông báo trình đọc màn hình (thuần). Mỗi hàm trả null khi KHÔNG nên báo (trạng thái không đổi) — tránh
// lặp lại liên tục theo từng sự kiện tiến độ. 123: dịch theo Translator truyền vào (mặc định tiếng Việt) — gọi với
// translator HIỆN TẠI lúc announce (hàng đợi LiveRegion giữ chuỗi đã dịch).

const VI = createTranslator("vi");

export function chatStartedMessage(tr: Translator = VI): string {
  return tr.t("a11y.chatStarted");
}

export function chatCancelledMessage(tr: Translator = VI): string {
  return tr.t("a11y.chatCancelled");
}

export interface ChatDoneInput {
  citationCount: number;
  notFound?: boolean;
  stopped?: boolean;
}

export function chatDoneMessage(
  { citationCount, notFound, stopped }: ChatDoneInput,
  tr: Translator = VI,
): string {
  if (stopped) return tr.t("a11y.chatStopped");
  // 108: câu thông báo ngắn cho trình đọc màn hình — CỐ Ý không kèm gợi ý (gợi ý nằm trong câu trả lời hiển thị).
  if (notFound) return tr.t("a11y.chatNotFound");
  return citationCount > 0
    ? tr.plural("a11y.chatDoneCitations", citationCount)
    : tr.t("a11y.chatDone");
}

/** Nhãn lỗi nguồn (mã, hoặc văn bản Việt cũ) ⇒ câu theo ngôn ngữ hiện tại. */
export function sourceErrorText(
  raw: string | null | undefined,
  tr: Translator = VI,
): string {
  const code = normalizeSourceErrorCode(raw);
  return code
    ? tr.t(`sources.error.${code}`)
    : tr.t("a11y.sourceErrorFallback");
}

export function sourceStatusMessage(
  prev: SourceStatus | undefined,
  event: Pick<SourceProgressEvent, "status" | "errorCode">,
  title: string | undefined,
  tr: Translator = VI,
): string | null {
  if (prev === event.status) return null;
  const named = title !== undefined && title !== "";
  switch (event.status) {
    case "processing":
      return named
        ? tr.t("a11y.sourceProcessingNamed", { title })
        : tr.t("a11y.sourceProcessing");
    case "awaiting_embedding":
      return named
        ? tr.t("a11y.sourceAwaitingNamed", { title })
        : tr.t("a11y.sourceAwaiting");
    case "ready":
      return named
        ? tr.t("a11y.sourceReadyNamed", { title })
        : tr.t("a11y.sourceReady");
    case "error": {
      const error = sourceErrorText(event.errorCode, tr);
      return named
        ? tr.t("a11y.sourceErrorNamed", { title, error })
        : tr.t("a11y.sourceError", { error });
    }
    default:
      return null; // queued: chưa có gì để báo
  }
}

/** prev=null: chưa biết trạng thái trước (lần đọc đầu). */
export function reindexMessage(
  prev: boolean | null,
  next: boolean,
  tr: Translator = VI,
): string | null {
  if (next && prev !== true) return tr.t("a11y.reindexStart");
  if (!next && prev === true) return tr.t("a11y.reindexDone");
  return null;
}

export function studioMessage(
  label: string,
  phase: "start" | "done",
  tr: Translator = VI,
): string {
  return phase === "start"
    ? tr.t("a11y.studioStart", { label })
    : tr.t("a11y.studioDone", { label });
}

/** 149: lượt tạo Studio đã huỷ (người dùng bấm Huỷ hoặc rời notebook) — câu kết thúc cho "Đang tạo …". */
export function studioCancelledMessage(
  label: string,
  tr: Translator = VI,
): string {
  return tr.t("a11y.studioCancelled", { label });
}

/** aria-valuetext cho thanh tiến độ: "Nhúng, 40%". */
export function progressValueText(
  step: string,
  pct: number,
  tr: Translator = VI,
): string {
  return tr.t("a11y.progressValue", { step, pct });
}
