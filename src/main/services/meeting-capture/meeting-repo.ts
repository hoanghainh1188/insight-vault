import type {
  LanguageMode,
  MeetingMarker,
  MeetingMarkerKind,
  MeetingPhase,
  PauseGap,
  PauseGapReason,
  TranscriptQuality,
} from "@shared/ipc/types";
import type { Db } from "../../db/database";
import type { TimeMapEntry } from "../ingestion/audio/audio-transcript";
import type { CaptureSegment } from "./segments";

// 186 — repo meeting_session / transcript_span (data-model §2). SQL tham số hoá; JSON trong DB coi là không tin cậy
// (hỏng ⇒ mảng rỗng, không ném). Đánh dấu (meeting_marker) thêm ở PR B.

export interface LanguageChange {
  atSec: number;
  lang: "vi" | "en";
  source: "auto" | "user";
}

export interface MeetingSession {
  sourceId: string;
  sessionId: string;
  phase: MeetingPhase;
  endedByUser: boolean;
  languageMode: LanguageMode;
  language: "vi" | "en" | null;
  languageChanges: LanguageChange[];
  deviceLabel: string | null;
  startedAt: number;
  endedAt: number | null;
  durationMs: number;
  segments: CaptureSegment[];
  pauseGaps: PauseGap[];
  transcriptQuality: TranscriptQuality | null;
  finalProgress: number;
  updatedAt: number;
}

export type MeetingSessionPatch = Partial<
  Pick<
    MeetingSession,
    | "phase"
    | "endedByUser"
    | "language"
    | "languageChanges"
    | "endedAt"
    | "durationMs"
    | "segments"
    | "pauseGaps"
    | "transcriptQuality"
    | "finalProgress"
  >
>;

export interface MeetingRepo {
  create(input: {
    sourceId: string;
    sessionId: string;
    languageMode: LanguageMode;
    deviceLabel?: string;
    startedAt: number;
  }): MeetingSession;
  get(sourceId: string): MeetingSession | null;
  getBySessionId(sessionId: string): MeetingSession | null;
  update(sourceId: string, patch: MeetingSessionPatch): void;
  listByPhase(phases: readonly MeetingPhase[]): MeetingSession[];
  replaceSpans(sourceId: string, spans: readonly TimeMapEntry[]): void;
  listSpans(sourceId: string): TimeMapEntry[];
  /** PR B — đánh dấu (D4). Giá trị đã kiểm ở service. */
  addMarker(m: MeetingMarker & { sourceId: string }): void;
  listMarkers(sourceId: string): MeetingMarker[];
}

interface Row {
  source_id: string;
  session_id: string;
  phase: MeetingPhase;
  ended_by_user: number;
  language_mode: LanguageMode;
  language: "vi" | "en" | null;
  language_changes_json: string;
  device_label: string | null;
  started_at: number;
  ended_at: number | null;
  duration_ms: number;
  segments_json: string;
  pause_gaps_json: string;
  transcript_quality: TranscriptQuality | null;
  final_progress: number;
  updated_at: number;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

function parseArray<T>(json: string, item: (v: unknown) => T | null): T[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.map(item).filter((x): x is T => x !== null);
}

const segmentItem = (v: unknown): CaptureSegment | null =>
  isObj(v) &&
  isNum(v["index"]) &&
  typeof v["file"] === "string" &&
  isNum(v["samples"]) &&
  typeof v["closed"] === "boolean"
    ? {
        index: v["index"],
        file: v["file"],
        samples: v["samples"],
        closed: v["closed"],
      }
    : null;

const GAP_REASONS: readonly PauseGapReason[] = [
  "user",
  "deviceLost",
  "interrupted",
];
const gapItem = (v: unknown): PauseGap | null =>
  isObj(v) &&
  isNum(v["atSec"]) &&
  isNum(v["wallSeconds"]) &&
  GAP_REASONS.includes(v["reason"] as PauseGapReason)
    ? {
        atSec: v["atSec"],
        wallSeconds: v["wallSeconds"],
        reason: v["reason"] as PauseGapReason,
      }
    : null;

const changeItem = (v: unknown): LanguageChange | null =>
  isObj(v) &&
  isNum(v["atSec"]) &&
  (v["lang"] === "vi" || v["lang"] === "en") &&
  (v["source"] === "auto" || v["source"] === "user")
    ? { atSec: v["atSec"], lang: v["lang"], source: v["source"] }
    : null;

function toSession(r: Row): MeetingSession {
  return {
    sourceId: r.source_id,
    sessionId: r.session_id,
    phase: r.phase,
    endedByUser: r.ended_by_user === 1,
    languageMode: r.language_mode,
    language: r.language,
    languageChanges: parseArray(r.language_changes_json, changeItem),
    deviceLabel: r.device_label,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    durationMs: r.duration_ms,
    segments: parseArray(r.segments_json, segmentItem),
    pauseGaps: parseArray(r.pause_gaps_json, gapItem),
    transcriptQuality: r.transcript_quality,
    finalProgress: r.final_progress,
    updatedAt: r.updated_at,
  };
}

/** Cột SQL cho từng trường patch — tên cột là hằng số nội bộ (không phải input), giá trị luôn bind `?`. */
const PATCH_COLUMNS: {
  [K in keyof Required<MeetingSessionPatch>]: [
    string,
    (v: MeetingSessionPatch[K]) => unknown,
  ];
} = {
  phase: ["phase", (v) => v],
  endedByUser: ["ended_by_user", (v) => (v ? 1 : 0)],
  language: ["language", (v) => v],
  languageChanges: ["language_changes_json", (v) => JSON.stringify(v ?? [])],
  endedAt: ["ended_at", (v) => v],
  durationMs: ["duration_ms", (v) => v],
  segments: ["segments_json", (v) => JSON.stringify(v ?? [])],
  pauseGaps: ["pause_gaps_json", (v) => JSON.stringify(v ?? [])],
  transcriptQuality: ["transcript_quality", (v) => v],
  finalProgress: ["final_progress", (v) => v],
};

export function createMeetingRepo(
  db: Db,
  deps: { now?: () => number } = {},
): MeetingRepo {
  const now = deps.now ?? Date.now;
  const selectOne = (where: string, arg: string): MeetingSession | null => {
    const r = db
      .prepare(`SELECT * FROM meeting_session WHERE ${where} = ?`)
      .get(arg) as Row | undefined;
    return r ? toSession(r) : null;
  };

  return {
    create(input) {
      const t = now();
      db.prepare(
        `INSERT INTO meeting_session (source_id, session_id, phase, language_mode, device_label, started_at, updated_at)
         VALUES (?,?,?,?,?,?,?)`,
      ).run(
        input.sourceId,
        input.sessionId,
        "recording",
        input.languageMode,
        input.deviceLabel ?? null,
        input.startedAt,
        t,
      );
      const s = selectOne("source_id", input.sourceId);
      if (!s) throw new Error("meeting session insert failed");
      return s;
    },
    get: (sourceId) => selectOne("source_id", sourceId),
    getBySessionId: (sessionId) => selectOne("session_id", sessionId),
    update(sourceId, patch) {
      const sets: string[] = [];
      const args: unknown[] = [];
      for (const key of Object.keys(patch) as (keyof MeetingSessionPatch)[]) {
        const entry = PATCH_COLUMNS[key] as
          [string, (v: unknown) => unknown] | undefined;
        if (!entry || patch[key] === undefined) continue;
        sets.push(`${entry[0]} = ?`);
        args.push(entry[1](patch[key]));
      }
      sets.push("updated_at = ?");
      args.push(now());
      db.prepare(
        `UPDATE meeting_session SET ${sets.join(", ")} WHERE source_id = ?`,
      ).run(...(args as (string | number | null)[]), sourceId);
    },
    listByPhase(phases) {
      if (phases.length === 0) return [];
      const marks = phases.map(() => "?").join(",");
      const rows = db
        .prepare(`SELECT * FROM meeting_session WHERE phase IN (${marks})`)
        .all(...phases) as unknown as Row[];
      return rows.map(toSession);
    },
    replaceSpans(sourceId, spans) {
      db.exec("BEGIN");
      try {
        db.prepare("DELETE FROM transcript_span WHERE source_id = ?").run(
          sourceId,
        );
        const ins = db.prepare(
          "INSERT INTO transcript_span (source_id, idx, char_start, char_end, t_start, t_end) VALUES (?,?,?,?,?,?)",
        );
        spans.forEach((s, i) =>
          ins.run(sourceId, i, s.charStart, s.charEnd, s.tStart, s.tEnd),
        );
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    listSpans(sourceId) {
      const rows = db
        .prepare(
          "SELECT char_start, char_end, t_start, t_end FROM transcript_span WHERE source_id = ? ORDER BY idx",
        )
        .all(sourceId) as unknown as {
        char_start: number;
        char_end: number;
        t_start: number;
        t_end: number;
      }[];
      return rows.map((r) => ({
        charStart: r.char_start,
        charEnd: r.char_end,
        tStart: r.t_start,
        tEnd: r.t_end,
      }));
    },
    addMarker(m) {
      db.prepare(
        "INSERT INTO meeting_marker (id, source_id, kind, t_start, t_end, created_at) VALUES (?,?,?,?,?,?)",
      ).run(m.id, m.sourceId, m.kind, m.tStart, m.tEnd, now());
    },
    listMarkers(sourceId) {
      const rows = db
        .prepare(
          "SELECT id, kind, t_start, t_end FROM meeting_marker WHERE source_id = ? ORDER BY t_start, created_at",
        )
        .all(sourceId) as unknown as {
        id: string;
        kind: MeetingMarkerKind;
        t_start: number;
        t_end: number;
      }[];
      return rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        tStart: r.t_start,
        tEnd: r.t_end,
      }));
    },
  };
}
