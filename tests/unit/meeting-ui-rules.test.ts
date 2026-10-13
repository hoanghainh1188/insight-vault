import { describe, it, expect } from "vitest";
import {
  needsEndConfirm,
  hideSourceProgress,
  isRecordingNotebook,
} from "../../src/renderer/features/meeting-capture/meeting-ui";
import { statusLabel } from "../../src/renderer/features/sources/source-status";
import { createTranslator } from "@shared/i18n";
import type { MeetingState, Source } from "@shared/ipc/types";

// 186 — quy tắc UI thuần của Ghi cuộc họp (FR-010, FR-013, A9, D15).

const vi = createTranslator("vi");
const src = (over: Partial<Source>): Source => ({
  id: "m1",
  notebookId: "nb1",
  kind: "meeting",
  title: "Họp",
  status: "processing",
  errorCode: null,
  pageCount: null,
  createdAt: 1,
  updatedAt: 1,
  extractionVersion: 1,
  ...over,
});
const state = (over: Partial<MeetingState> = {}): MeetingState => ({
  sessionId: "s",
  sourceId: "m1",
  notebookId: "nb1",
  title: "Họp",
  phase: "recording",
  durationSec: 10,
  segments: [],
  diskLevel: "ok",
  minutesRemaining: 100,
  transcriptLagging: false,
  language: { mode: "vi", current: "vi", status: "manual" },
  modelReady: true,
  ...over,
});

describe("needsEndConfirm (D15: ≥ 5 phút)", () => {
  it("dưới 300 s không hỏi, từ 300 s hỏi", () => {
    expect(needsEndConfirm(299.9)).toBe(false);
    expect(needsEndConfirm(300)).toBe(true);
  });
});

describe("statusLabel cho nguồn cuộc họp (A9)", () => {
  it("nhãn theo phase thay cho status", () => {
    expect(statusLabel(src({ meetingPhase: "recording" }), vi)).toBe(
      "Đang ghi",
    );
    expect(statusLabel(src({ meetingPhase: "paused" }), vi)).toBe(
      "Đã tạm dừng",
    );
    expect(statusLabel(src({ meetingPhase: "finalizing" }), vi)).toBe(
      "Đang hoàn tất",
    );
    expect(
      statusLabel(src({ status: "ready", meetingPhase: "incomplete" }), vi),
    ).toBe("Chưa hoàn thiện");
  });

  it("done ⇒ nhãn status bình thường; nguồn khác không đổi", () => {
    expect(
      statusLabel(src({ status: "ready", meetingPhase: "done" }), vi),
    ).toBe(statusLabel(src({ kind: "pdf", status: "ready" }), vi));
  });
});

describe("hideSourceProgress", () => {
  it("ẩn thanh tiến độ khi đang ghi/tạm dừng (chưa có gì để xử lý)", () => {
    expect(hideSourceProgress(src({ meetingPhase: "recording" }))).toBe(true);
    expect(hideSourceProgress(src({ meetingPhase: "paused" }))).toBe(true);
    expect(hideSourceProgress(src({ meetingPhase: "finalizing" }))).toBe(false);
    expect(hideSourceProgress(src({ kind: "pdf" }))).toBe(false);
  });
});

describe("isRecordingNotebook", () => {
  it("chỉ khi phiên đang ghi/tạm dừng thuộc notebook đó", () => {
    expect(isRecordingNotebook(state(), "nb1")).toBe(true);
    expect(isRecordingNotebook(state({ phase: "paused" }), "nb1")).toBe(true);
    expect(isRecordingNotebook(state(), "nb2")).toBe(false);
    expect(isRecordingNotebook(state({ phase: "finalizing" }), "nb1")).toBe(
      false,
    );
    expect(isRecordingNotebook(null, "nb1")).toBe(false);
  });
});
