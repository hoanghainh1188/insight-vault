import { createTranslator, type Translator } from "@shared/i18n";
import { SchemaVersionError } from "../../db/migrations";

/**
 * Ánh xạ lỗi khởi động → thông báo hiển thị cho người dùng (dialog native).
 *
 * THUẦN (không I/O) để test được. Constitution III: KHÔNG chèn message thô của lỗi
 * (có thể chứa đường dẫn/nội dung) vào `detail` — chỉ dùng tên loại lỗi (constructor)
 * và các trường số schema an toàn. `errorType` trả kèm để tầng gọi log an toàn.
 */
export interface StartupErrorDialog {
  title: string;
  detail: string;
  /** Tên loại lỗi an toàn để log (không chứa nội dung). */
  errorType: string;
}

function errorTypeOf(err: unknown): string {
  if (err instanceof Error) return err.constructor.name;
  return typeof err;
}

/** 123: dịch theo translator truyền vào — lúc khởi động là ngôn ngữ OS (cài đặt có thể chưa đọc được). */
export function startupErrorDialog(
  err: unknown,
  tr: Translator = createTranslator("vi"),
): StartupErrorDialog {
  if (err instanceof SchemaVersionError) {
    return {
      title: tr.t("dialogs.schemaNewer.title"),
      detail: tr.t("dialogs.schemaNewer.detail", {
        dbVersion: err.dbVersion,
        appVersion: err.appVersion,
      }),
      errorType: err.constructor.name,
    };
  }

  const errorType = errorTypeOf(err);
  return {
    title: tr.t("dialogs.startupError.title"),
    detail: tr.t("dialogs.startupError.detail", { errorType }),
    errorType,
  };
}
