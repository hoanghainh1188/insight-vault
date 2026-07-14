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

export function startupErrorDialog(err: unknown): StartupErrorDialog {
  if (err instanceof SchemaVersionError) {
    return {
      title: "Cần cập nhật InsightVault",
      detail:
        `Dữ liệu trên máy được tạo bởi một phiên bản InsightVault mới hơn ` +
        `(schema v${err.dbVersion}), trong khi bản đang chạy chỉ hỗ trợ tới v${err.appVersion}.\n\n` +
        `Vui lòng cập nhật InsightVault lên phiên bản mới nhất rồi mở lại. ` +
        `Dữ liệu của bạn vẫn an toàn — ứng dụng cố ý không hạ cấp để tránh mất dữ liệu.`,
      errorType: err.constructor.name,
    };
  }

  return {
    title: "InsightVault gặp lỗi khi khởi động",
    detail:
      `Ứng dụng không thể khởi động (loại lỗi: ${errorTypeOf(err)}).\n\n` +
      `Vui lòng mở lại ứng dụng. Nếu vẫn lỗi, hãy cập nhật lên phiên bản mới nhất.`,
    errorType: errorTypeOf(err),
  };
}
