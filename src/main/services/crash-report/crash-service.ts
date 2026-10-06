import type { CrashNotice, CrashReportDraft } from "@shared/ipc/types";
import {
  buildIssueUrl,
  buildReport,
  isAllowedIssueUrl,
  parseLogRecords,
  reportTitle,
  summarizeNativeCrashes,
  validateIssueInput,
  type ReportEnv,
} from "./report";

// 093 — service báo lỗi opt-in (DI, không chạm electron trực tiếp). Mọi việc gửi đi đều do người dùng bấm: service
// chỉ soạn bản nháp và mở trình duyệt tới đích CỐ ĐỊNH; app không tự kết nối mạng.

export interface CrashServiceDeps {
  env: ReportEnv;
  home: string;
  /** Phiên trước kết thúc bất thường (tệp đánh dấu còn sót lúc khởi động). */
  abnormalExit: boolean;
  readLogLines: () => string[];
  listDumps: () => { mtimeMs: number }[];
  getAckedAt: () => number;
  setAckedAt: (ms: number) => void;
  openExternal: (url: string) => Promise<void>;
  now: () => number;
  log: (event: string, meta: Record<string, unknown>) => void;
  /** Khoảng cách tối thiểu giữa 2 lần mở trình duyệt (chặn renderer bị chiếm mở tab dồn dập). */
  minIntervalMs?: number;
  /** Số lần mở tối đa mỗi phiên. */
  maxPerSession?: number;
  /** Dựng URL (tiêm để test lưới kiểm host); mặc định buildIssueUrl. */
  buildUrl?: (title: string, text: string) => string;
}

export type OpenIssueResult = { ok: true } | { ok: false; throttled?: true };

export interface CrashService {
  getReport(): CrashReportDraft;
  getNotice(): CrashNotice;
  dismissNotice(): { ok: true };
  openIssue(input: unknown): Promise<OpenIssueResult>;
}

const errorTypeOf = (e: unknown): string =>
  e instanceof Error ? e.constructor.name : typeof e;

/** Đọc lỗi (tệp chưa có, quyền…) không được chặn việc soạn báo cáo. */
function safely<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function createCrashService(deps: CrashServiceDeps): CrashService {
  const {
    minIntervalMs = 5000,
    maxPerSession = 5,
    buildUrl = buildIssueUrl,
  } = deps;
  let abnormal = deps.abnormalExit;
  let opened = 0;
  let lastOpenedAt = Number.NEGATIVE_INFINITY;
  const dumps = (): { mtimeMs: number }[] => safely(deps.listDumps, []);
  const acknowledge = (): void => {
    abnormal = false;
    deps.setAckedAt(deps.now());
  };

  return {
    getReport() {
      return {
        title: reportTitle(deps.env),
        text: buildReport({
          env: deps.env,
          records: parseLogRecords(safely(deps.readLogLines, [])),
          nativeCrashes: summarizeNativeCrashes(dumps(), 0),
          home: deps.home,
        }),
      };
    },
    getNotice() {
      return {
        abnormalExit: abnormal,
        newNativeCrashes: summarizeNativeCrashes(dumps(), deps.getAckedAt())
          .count,
      };
    },
    dismissNotice() {
      acknowledge();
      return { ok: true };
    },
    async openIssue(input) {
      const valid = validateIssueInput(input);
      if (!valid) return { ok: false };
      const now = deps.now();
      if (opened >= maxPerSession || now - lastOpenedAt < minIntervalMs) {
        return { ok: false, throttled: true };
      }
      const url = buildUrl(valid.title, valid.text);
      // Lưới cuối trước khi giao cho HĐH (Electron security checklist: chỉ openExternal URL đã kiểm).
      if (!isAllowedIssueUrl(url)) {
        deps.log("crash.issueUrlRejected", {});
        return { ok: false };
      }
      opened += 1;
      lastOpenedAt = now;
      try {
        await deps.openExternal(url);
      } catch (e) {
        deps.log("crash.issueOpenFailed", { errorType: errorTypeOf(e) });
        return { ok: false };
      }
      acknowledge();
      deps.log("crash.issueOpened", { chars: valid.text.length });
      return { ok: true };
    },
  };
}
