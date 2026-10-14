import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHANNELS, isWhitelisted } from "../../src/shared/ipc/channels";

// 186 — kênh IPC Ghi cuộc họp (contracts/meeting-ipc.md, PR A): whitelist + preload có hàm riêng từng kênh.

const PR_A = {
  meetingPrepare: "meeting:prepare",
  meetingStart: "meeting:start",
  meetingAudio: "meeting:audio",
  meetingPause: "meeting:pause",
  meetingResume: "meeting:resume",
  meetingStop: "meeting:stop",
  meetingStatus: "meeting:status",
  meetingRename: "meeting:rename",
  meetingState: "meeting:state",
} as const;

const PR_B = {
  meetingDraft: "meeting:draft",
  meetingSetLanguage: "meeting:setLanguage",
  meetingMark: "meeting:mark",
  meetingListMarkers: "meeting:listMarkers",
  meetingDownloadModel: "meeting:downloadModel",
} as const;

const PR_C1 = {
  meetingListRecoverable: "meeting:listRecoverable",
  meetingRecover: "meeting:recover",
  meetingFinalizeAgain: "meeting:finalizeAgain",
  meetingRecoverable: "meeting:recoverable",
} as const;

describe("meeting:* whitelist PR C1", () => {
  it("đủ kênh PR C1 + preload có hàm riêng", () => {
    for (const [key, name] of Object.entries(PR_C1)) {
      expect((CHANNELS as Record<string, string>)[key]).toBe(name);
      expect(isWhitelisted(name)).toBe(true);
    }
    const preload = readFileSync(
      join(process.cwd(), "src/preload/index.ts"),
      "utf8",
    );
    for (const fn of [
      "meetingListRecoverable",
      "meetingRecover",
      "meetingFinalizeAgain",
      "onMeetingRecoverable",
    ]) {
      expect(preload).toContain(`${fn}:`);
    }
  });
});

describe("meeting:* whitelist PR B", () => {
  it("đủ kênh PR B + preload có hàm riêng", () => {
    for (const [key, name] of Object.entries(PR_B)) {
      expect((CHANNELS as Record<string, string>)[key]).toBe(name);
      expect(isWhitelisted(name)).toBe(true);
    }
    const preload = readFileSync(
      join(process.cwd(), "src/preload/index.ts"),
      "utf8",
    );
    for (const fn of [
      "meetingSetLanguage",
      "meetingMark",
      "meetingListMarkers",
      "meetingDownloadModel",
      "onMeetingDraft",
    ]) {
      expect(preload).toContain(`${fn}:`);
    }
  });
});

describe("meeting:* whitelist (186)", () => {
  it("đủ kênh PR A, tên đúng, không trùng", () => {
    for (const [key, name] of Object.entries(PR_A)) {
      expect((CHANNELS as Record<string, string>)[key]).toBe(name);
      expect(isWhitelisted(name)).toBe(true);
    }
    expect(new Set(Object.values(CHANNELS)).size).toBe(
      Object.values(CHANNELS).length,
    );
  });

  it("kênh lạ bị từ chối", () => {
    expect(isWhitelisted("meeting:deleteFile")).toBe(false);
    expect(isWhitelisted("meeting:readAudio")).toBe(false);
  });

  it("preload có hàm cho từng kênh (send cho audio, on* cho push)", () => {
    const preload = readFileSync(
      join(process.cwd(), "src/preload/index.ts"),
      "utf8",
    );
    for (const fn of [
      "meetingPrepare",
      "meetingStart",
      "meetingSendAudio",
      "meetingPause",
      "meetingResume",
      "meetingStop",
      "meetingStatus",
      "meetingRename",
      "onMeetingState",
    ]) {
      expect(preload).toContain(`${fn}:`);
    }
    expect(preload).toMatch(/ipcRenderer\.send\(CHANNELS\.meetingAudio/);
  });
});
