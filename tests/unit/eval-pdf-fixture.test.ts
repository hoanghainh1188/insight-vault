import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { parsePdf } from "../../src/main/services/ingestion/parsers/pdf";
import { EVAL_FIXTURE_ID, buildEvalFixturePdf } from "../eval/lib/pdf-fixture";
import {
  docFile,
  normalizeForMatch,
  sha256Hex,
  type EvalDocument,
} from "../eval/lib/dataset";

// 177 (T009, research R4–R5): PDF fixture của bộ đánh giá — tất định, đủ đặc trưng 112/147 (bảng số căn phải, trang ngang, gạch nối
// vi + en, hai cột, đáp án cuối trang). Tệp commit phải trùng từng byte với bản sinh. Tái tạo: UPDATE_EVAL_FIXTURE=1.

const CORPUS = join(__dirname, "../eval/corpus");
const manifest = JSON.parse(
  readFileSync(join(CORPUS, "manifest.json"), "utf8"),
) as EvalDocument[];

// pdfjs CHUYỂN QUYỀN (detach) ArrayBuffer đầu vào ⇒ mỗi lần parse dùng bản sao, `bytes` giữ nguyên để so sha256.
const bytes = buildEvalFixturePdf();
const norm = (s: string) => normalizeForMatch(s);

if (process.env.UPDATE_EVAL_FIXTURE === "1") {
  const entry = manifest.find((d) => d.id === EVAL_FIXTURE_ID);
  writeFileSync(
    join(CORPUS, entry ? docFile(entry) : `${EVAL_FIXTURE_ID}.pdf`),
    bytes,
  );
}

describe("buildEvalFixturePdf", () => {
  it("tất định: hai lần sinh giống hệt từng byte", () => {
    expect(sha256Hex(buildEvalFixturePdf())).toBe(sha256Hex(bytes));
  });

  it("4 trang; trang 4 khổ ngang (/Rotate 90) vẫn trích được chữ", async () => {
    const { pages, pageCount } = await parsePdf(bytes.slice());
    expect(pageCount).toBe(4);
    expect(norm(pages[3].text)).toContain("Phụ lục: lịch kiểm tra kho định kỳ");
    expect(norm(pages[3].text)).toContain(
      "Kho được kiểm tra phòng cháy vào ngày mười lăm của tháng cuối mỗi quý.",
    );
  });

  it("trang 1: gạch nối cuối dòng — tiếng Việt giữ 'hợp-đồng', tiếng Anh nối lại 'long-term'; câu cuối trang có mặt", async () => {
    const p1 = norm((await parsePdf(bytes.slice())).pages[0].text);
    expect(p1).toContain("Bản hợp-đồng thuê kho này có hiệu lực");
    expect(p1).toContain("a long-term lease of the warehouse");
    expect(p1).not.toContain("long- term");
    expect(p1).toContain(
      "Mọi tranh chấp được giải quyết tại tòa án nơi đặt kho.",
    );
  });

  it("trang 2: hai cột không trộn dòng", async () => {
    const p2 = norm((await parsePdf(bytes.slice())).pages[1].text);
    expect(p2).toContain(
      "Bên thuê trả phí thuê trước ngày mười của tháng đầu mỗi quý và giữ kho sạch sẽ, khô ráo.",
    );
    expect(p2).toContain(
      "Bên cho thuê bảo trì mái kho, hệ thống điện và bình chữa cháy theo đúng lịch đã thỏa thuận.",
    );
  });

  it("trang 3: bảng số căn phải ⇒ bảng Markdown", async () => {
    const p3 = (await parsePdf(bytes.slice())).pages[2].text;
    expect(p3).toContain("| Quý | Diện tích (m2) | Phí thuê (triệu đồng) |");
    expect(p3).toContain("| Quý 3 | 1.250 | 87,5 |");
    expect(p3).toContain("| Cả năm | 4.800 | 336,0 |");
  });

  it("tệp commit trùng từng byte với bản sinh + sha256 trong manifest", () => {
    const entry = manifest.find((d) => d.id === EVAL_FIXTURE_ID);
    expect(entry, "thiếu mục manifest của PDF fixture").toBeDefined();
    expect(entry!.format).toBe("pdf");
    expect(entry!.license).toBe("CC0-1.0");
    const path = join(CORPUS, docFile(entry!));
    expect(existsSync(path)).toBe(true);
    expect(sha256Hex(new Uint8Array(readFileSync(path)))).toBe(
      sha256Hex(bytes),
    );
    expect(entry!.sha256).toBe(sha256Hex(bytes));
  });
});
