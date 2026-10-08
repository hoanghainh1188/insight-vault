import type {
  VaultBackupErrorCode,
  VaultBackupState,
  VaultBackupStep,
} from "@shared/ipc/types";
import { createTranslator, type Translator } from "@shared/i18n";

// Văn phong UI cho sao lưu/khôi phục (085). Thuần — unit-test được. 123: dịch theo Translator truyền vào (mặc định
// tiếng Việt); state giữ MÃ, gọi các hàm này lúc render.

const VI = createTranslator("vi");

const ERROR_CODES: readonly VaultBackupErrorCode[] = [
  "busy",
  "passwordTooShort",
  "notBackup",
  "unsupportedFormat",
  "badPasswordOrCorrupt",
  "passwordRequired",
  "newerSchema",
  "diskFull",
  "tokenInvalid",
  "ioError",
];

export const errorMessage = (
  code: VaultBackupErrorCode,
  tr: Translator = VI,
): string =>
  tr.t(`backup.error.${ERROR_CODES.includes(code) ? code : "ioError"}`);

export const stepLabel = (step: VaultBackupStep, tr: Translator = VI): string =>
  tr.t(`backup.step.${step}`);

export const busyReasonLabel = (
  reason: VaultBackupState["reason"],
  tr: Translator = VI,
): string => (reason ? tr.t(`backup.busy.${reason}`) : "");
