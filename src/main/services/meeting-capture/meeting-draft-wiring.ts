import { createDraftEngine, type DraftEngine } from "./draft-engine";
import { summarizeRtf } from "./draft-model-policy";
import {
  languagePolicy,
  needsDetection,
  windowLanguage,
  type LanguageEvent,
  type LanguageState,
} from "./language-policy";
import {
  DRAFT_PARTIAL_PASS,
  DRAFT_PARTIAL_SEC,
  DRAFT_WINDOW_SEC,
} from "./meeting-constants";
import type { MeetingServiceDeps } from "./meeting-service";

// 186 PR B — nối bộ máy nháp + chính sách ngôn ngữ vào phiên đang ghi (tách khỏi meeting-service để file gọn). Mọi callback
// kiểm `isActive(a)` ⇒ kết quả về muộn của phiên đã kết thúc bị bỏ. Không log nội dung.

/** Phần trạng thái phiên mà PR B đọc/ghi. */
export interface LiveSession {
  sessionId: string;
  sourceId: string;
  ownerId: number;
  lang: LanguageState;
  draft: DraftEngine;
  lagging: boolean;
  modelReady: boolean;
}

type Log = (
  event: string,
  meta?: Record<string, string | number | boolean>,
) => void;

export interface DraftWiringContext {
  deps: MeetingServiceDeps;
  isActive(a: LiveSession): boolean;
  pushState(a: LiveSession): void;
  enqueueIo(fn: () => Promise<void>): Promise<void>;
  log: Log;
}

export interface DraftWiring {
  createDraft(a: LiveSession): DraftEngine;
  /** Áp một sự kiện ngôn ngữ: lưu phiên (ngôn ngữ hiệu lực + lịch sử đổi), báo cửa sổ ghi. */
  applyLanguage(a: LiveSession, e: LanguageEvent): void;
  /** Dòng chẩn đoán hiệu năng cuối phiên (ADR mục 7): máy + RTF nháp. KHÔNG nội dung/tiêu đề/đường dẫn. */
  logPerf(a: LiveSession): void;
}

export function createDraftWiring(ctx: DraftWiringContext): DraftWiring {
  const { deps, log } = ctx;

  const applyLanguage = (a: LiveSession, e: LanguageEvent): void => {
    const before = a.lang;
    a.lang = languagePolicy(a.lang, e);
    if (a.lang === before) return;
    if (a.lang.changes !== before.changes || a.lang.locked !== before.locked) {
      deps.repo.update(a.sourceId, {
        language: a.lang.locked?.lang ?? null,
        languageChanges: a.lang.changes,
      });
    }
    if (a.lang.suggestion && a.lang.suggestion !== before.suggestion)
      log("meeting.languageSuggested", { language: a.lang.suggestion });
    if (a.lang.locked && a.lang.locked.lang !== before.locked?.lang)
      log("meeting.languageLocked", {
        language: a.lang.locked.lang,
        source: a.lang.locked.source,
      });
    ctx.pushState(a);
  };

  const createDraft = (a: LiveSession): DraftEngine =>
    createDraftEngine({
      asr: deps.asr,
      sampleRate: deps.sampleRate,
      windowSec: DRAFT_WINDOW_SEC,
      partialSec: DRAFT_PARTIAL_SEC,
      partialPass: DRAFT_PARTIAL_PASS,
      windowLanguage: () => windowLanguage(a.lang),
      shouldDetect: (speechSec, audioSec) =>
        ctx.isActive(a) && needsDetection(a.lang, speechSec, audioSec),
      onLines: (windows) => {
        if (ctx.isActive(a))
          deps.pushDraft(a.ownerId, {
            sessionId: a.sessionId,
            windows,
            full: false,
          });
      },
      onLagging: (lagging) => {
        if (!ctx.isActive(a)) return;
        a.lagging = lagging;
        if (lagging) log("meeting.draftLagging");
        ctx.pushState(a);
      },
      onDetected: (lang, confidence, atSec) => {
        if (ctx.isActive(a))
          applyLanguage(a, { type: "detected", lang, confidence, atSec });
      },
      onModelMissing: () => {
        if (!ctx.isActive(a)) return;
        a.modelReady = false;
        log("meeting.draftModelMissing");
        ctx.pushState(a);
      },
      persistLine: (line) => {
        void ctx
          .enqueueIo(() => deps.files.appendDraft(a.sessionId, line))
          .catch(() => undefined);
      },
      log,
    });

  const logPerf = (a: LiveSession): void => {
    const p = a.draft.perf();
    const sum = summarizeRtf(p.all);
    log("meeting.perf", {
      ...deps.machineInfo(),
      draftWindows: sum?.count ?? 0,
      draftRtfMean: sum?.mean ?? 0,
      draftRtfP95: sum?.p95 ?? 0,
      draftDropped: a.draft.dropped(),
      draftDowngraded: p.downgraded,
      draftModel: p.tier,
    });
  };

  return { createDraft, applyLanguage, logPerf };
}
