import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import type { EvalDocument, QuestionsFile } from "../eval/lib/dataset";

// 187 (T010, FR-013, research R4): bộ câu hỏi v5 — ~2 câu không đáp án sát chủ đề cho MỖI tài liệu thật (`topicDocId`), câu về PDF giữ
// `topic: "pdf"`; ≥ 2 câu mới có đáp án nằm trong dòng bảng (ngoài bộ kiểm q-162 / q-170 / q-171); câu mới đều tiếng Việt; dev chiếm
// 60–80% mỗi loại câu mới. Đọc tệp THẬT — không mô hình, không mạng.

const EVAL_DIR = join(__dirname, "../eval");
const manifest = JSON.parse(
  readFileSync(join(EVAL_DIR, "corpus", "manifest.json"), "utf8"),
) as EvalDocument[];
const file = JSON.parse(
  readFileSync(join(EVAL_DIR, "questions.json"), "utf8"),
) as QuestionsFile;
const qs = file.questions;

/** v4 kết thúc ở q-183 — câu v5 là câu có số lớn hơn. */
const V4_LAST = 183;
const num = (id: string) => Number(id.slice(2));
const added = qs.filter((q) => num(q.id) > V4_LAST);
const TABLE_GUARD = new Set(["q-162", "q-170", "q-171"]);

describe("bộ câu hỏi v5 (187)", () => {
  it('datasetVersion "5"', () => {
    expect(file.datasetVersion).toBe("5");
  });

  it.each(manifest.filter((d) => !d.noise).map((d) => [d.id, d] as const))(
    "%s: có ≥ 2 câu không đáp án sát chủ đề (topicDocId)",
    (id, d) => {
      const near = qs.filter(
        (q) => q.type === "unanswerable" && q.topicDocId === id,
      );
      expect(near.length).toBeGreaterThanOrEqual(2);
      if (d.format === "pdf") {
        expect(near.every((q) => q.topic === "pdf")).toBe(true);
      }
    },
  );

  it("≥ 2 câu mới có đáp án nằm trong dòng bảng (ngoài bộ kiểm bảng)", () => {
    const table = qs.filter(
      (q) =>
        q.type === "answerable" &&
        !TABLE_GUARD.has(q.id) &&
        q.quotes.some((t) => t.trimStart().startsWith("|")),
    );
    expect(table.length).toBeGreaterThanOrEqual(2);
  });

  it("câu mới đều tiếng Việt", () => {
    expect(added.length).toBeGreaterThanOrEqual(20);
    expect(added.filter((q) => q.lang !== "vi").map((q) => q.id)).toEqual([]);
  });

  it.each(["answerable", "unanswerable"] as const)(
    "câu mới loại %s: dev chiếm 60–80%%",
    (type) => {
      const xs = added.filter((q) => q.type === type);
      const dev = xs.filter((q) => q.split === "dev").length / xs.length;
      expect(dev).toBeGreaterThanOrEqual(0.6);
      expect(dev).toBeLessThanOrEqual(0.8);
    },
  );

  it("không đổi câu v4 (id liên tục q-001…q-183 vẫn có mặt)", () => {
    const ids = new Set(qs.map((q) => q.id));
    for (let i = 1; i <= V4_LAST; i += 1) {
      expect(ids.has(`q-${String(i).padStart(3, "0")}`)).toBe(true);
    }
  });
});
