import { describe, it, expect } from "vitest";
import { createTranslator } from "@shared/i18n";
import {
  buildMeetingMarkdown,
  markerExcerpt,
  escapeMarkdownInline,
  type MeetingMarkdownMeta,
} from "../../src/main/services/meeting-capture/meeting-markdown";

// 186 PR C2 (R18, D12) — xuất Markdown cuộc họp (dựng ở main, renderer không gửi nội dung). THUẦN.

const text =
  "Chào mọi người. Chúng ta chốt dời demo sang thứ Sáu. Ai viết hướng dẫn? Anh Minh làm.";
const spans = [
  { charStart: 0, charEnd: 15, tStart: 0, tEnd: 3 },
  { charStart: 16, charEnd: 52, tStart: 3, tEnd: 9 },
  { charStart: 53, charEnd: 71, tStart: 400, tEnd: 404 },
  { charStart: 72, charEnd: 85, tStart: 3725, tEnd: 3728 },
];
const markers = [
  { id: "m1", kind: "decision" as const, tStart: 4, tEnd: 4 },
  { id: "m2", kind: "question" as const, tStart: 400, tEnd: 403 },
  { id: "m3", kind: "actionItem" as const, tStart: 3726, tEnd: 3726 },
];
const gaps = [{ atSec: 9, wallSeconds: 125, reason: "user" as const }];
const meta: MeetingMarkdownMeta = {
  title: "Họp *tiến độ* #3 [Q3]",
  dateLabel: "12/10/2026, 14:30",
  durationSec: 3728,
  language: "vi",
};

describe("markerExcerpt", () => {
  it("đánh dấu điểm ⇒ câu chứa thời điểm đó", () => {
    expect(markerExcerpt(text, spans, markers[0]!)).toBe(
      "Chúng ta chốt dời demo sang thứ Sáu.",
    );
  });

  it("đánh dấu khoảng ⇒ các câu giao với khoảng", () => {
    expect(
      markerExcerpt(text, spans, {
        id: "x",
        kind: "question",
        tStart: 1,
        tEnd: 5,
      }),
    ).toBe("Chào mọi người. Chúng ta chốt dời demo sang thứ Sáu.");
  });

  it("dài quá giới hạn ⇒ cắt ở ranh giới từ + …", () => {
    const r = markerExcerpt(
      text,
      spans,
      { id: "x", kind: "question", tStart: 0, tEnd: 9 },
      24,
    );
    expect(r).toBe("Chào mọi người. Chúng…");
  });

  it("không có câu nào ⇒ chuỗi rỗng", () => {
    expect(markerExcerpt(text, [], markers[0]!)).toBe("");
  });
});

describe("escapeMarkdownInline", () => {
  it("escape ký tự Markdown, giữ chữ tiếng Việt", () => {
    expect(escapeMarkdownInline("Họp *tiến độ* #3 [Q3] _x_ `y` <b>")).toBe(
      "Họp \\*tiến độ\\* \\#3 \\[Q3\\] \\_x\\_ \\`y\\` \\<b\\>",
    );
  });
});

describe("buildMeetingMarkdown", () => {
  it("tiếng Việt: tiêu đề escape, ngày, thời lượng, ngôn ngữ, đánh dấu, [hh:mm:ss] mỗi đoạn, dòng tạm dừng", () => {
    const md = buildMeetingMarkdown(
      meta,
      text,
      spans,
      markers,
      gaps,
      createTranslator("vi"),
    );
    expect(md).toBe(
      [
        "# Họp \\*tiến độ\\* \\#3 \\[Q3\\]",
        "",
        "- Ngày: 12/10/2026, 14:30",
        "- Thời lượng: 01:02:08",
        "- Ngôn ngữ: Tiếng Việt",
        "",
        "## Đánh dấu",
        "",
        "- [00:00:04] **Quyết định** — Chúng ta chốt dời demo sang thứ Sáu.",
        "- [00:06:40] **Câu hỏi** — Ai viết hướng dẫn?",
        "- [01:02:06] **Việc cần làm** — Anh Minh làm.",
        "",
        "## Transcript",
        "",
        "[00:00:00] Chào mọi người.",
        "",
        "[00:00:03] Chúng ta chốt dời demo sang thứ Sáu.",
        "",
        "_— Tạm dừng 00:02:05 —_",
        "",
        "[00:06:40] Ai viết hướng dẫn?",
        "",
        "[01:02:05] Anh Minh làm.",
        "",
      ].join("\n"),
    );
  });

  it("tiếng Anh + không đánh dấu + không rõ ngôn ngữ ⇒ bỏ mục tương ứng", () => {
    const md = buildMeetingMarkdown(
      { ...meta, title: "Weekly sync", language: null },
      text,
      spans.slice(0, 1),
      [],
      [{ atSec: 0, wallSeconds: 5, reason: "deviceLost" }],
      createTranslator("en"),
    );
    expect(md).toBe(
      [
        "# Weekly sync",
        "",
        "- Date: 12/10/2026, 14:30",
        "- Duration: 01:02:08",
        "",
        "## Transcript",
        "",
        "_— Microphone lost 00:00:05 —_",
        "",
        "[00:00:00] Chào mọi người.",
        "",
      ].join("\n"),
    );
  });

  it("khoảng ngừng sau câu cuối vẫn được ghi; lý do interrupted có nhãn riêng", () => {
    const md = buildMeetingMarkdown(
      meta,
      text,
      spans.slice(0, 1),
      [],
      [{ atSec: 50, wallSeconds: 3, reason: "interrupted" }],
      createTranslator("vi"),
    );
    expect(md.trimEnd().endsWith("_— Gián đoạn 00:00:03 —_")).toBe(true);
  });

  it("transcript rỗng ⇒ vẫn có tiêu đề + metadata + ghi chú chưa có transcript", () => {
    const md = buildMeetingMarkdown(
      meta,
      "",
      [],
      [],
      [],
      createTranslator("vi"),
    );
    expect(md).toContain("## Transcript\n\n_Chưa có transcript._\n");
  });
});
