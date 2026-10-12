import {
  CHAR_WIDTH,
  layoutParagraph,
  makePdf,
  rotateForDisplay,
  type FixtureLine,
  type FixturePage,
  type FixtureText,
} from "../../fixtures/pdf/make-pdf";

// 177 (research R4): PDF fixture của bộ đánh giá truy xuất — văn bản TIẾNG VIỆT TỰ SOẠN (CC0-1.0; hợp đồng thuê kho hư cấu, không
// trùng chủ đề corpus), sinh tất định bằng make-pdf. Bốn trang mang đủ đặc trưng 112/147 để đo truy xuất trên văn bản parsePdf:
// (1) văn xuôi + gạch nối cuối dòng (vi giữ "hợp-đồng", en nối "long-term") + câu đáp án sát cuối trang · (2) hai cột ·
// (3) bảng số căn phải có đường kẻ · (4) trang khổ ngang (/Rotate 90). Đổi nội dung ⇒ tái tạo (UPDATE_EVAL_FIXTURE=1), cập nhật
// sha256 + trích dẫn + datasetVersion.

export const EVAL_FIXTURE_ID = "hop-dong-thue-kho";

const W = 600;
const H = 800;
const SIZE = 10;
const LEAD = 12;
const PARA_GAP = 26;
const CHAR = SIZE * (CHAR_WIDTH / 1000);

/** Dàn nhiều đoạn liên tiếp từ (x, y); trả dòng + y kế tiếp. */
function paragraphs(
  x: number,
  y: number,
  width: number,
  texts: readonly string[],
  hyphenateAt: readonly string[] = [],
): { texts: FixtureText[]; next: number } {
  let cur = y;
  const out: FixtureText[] = [];
  for (const t of texts) {
    const lines = layoutParagraph(t, {
      x,
      y: cur,
      width,
      size: SIZE,
      leading: LEAD,
      hyphenateAt,
    });
    out.push(...lines);
    cur += (lines.length - 1) * LEAD + PARA_GAP;
  }
  return { texts: out, next: cur };
}

const at = (x: number, y: number, text: string): FixtureText => ({
  x,
  y,
  size: SIZE,
  text,
});
const rightAt = (right: number, y: number, text: string): FixtureText =>
  at(right - CHAR * [...text].length, y, text);

function pageOne(): FixturePage {
  const head = paragraphs(50, 60, 500, [
    "HỢP ĐỒNG THUÊ KHO SỐ 07/2026",
    "Hợp đồng này được lập giữa bên cho thuê là công ty kho vận Sông Cầu và bên thuê là hợp tác xã gốm Làng Mới. Hai bên thỏa thuận một long-term lease, tức thuê dài hạn, cho kho số 3 tại khu công nghiệp Bắc Hồng.",
  ]);
  // Gạch nối cuối dòng: "hợp-" | "đồng" (tiếng Việt giữ gạch) và "long-" | "term" (tiếng Anh nối lại nhờ bằng chứng ở trên).
  const body = paragraphs(
    50,
    head.next,
    500,
    [
      "Bản hợp-đồng thuê kho này có hiệu lực từ ngày ký và kéo dài năm năm.",
      "Both parties agree to a long-term lease of the warehouse with a yearly review.",
      "Kho có diện tích một nghìn hai trăm năm mươi mét vuông, nền bê tông chịu tải ba tấn trên mỗi mét vuông, có hai cửa cuốn và một bãi đỗ xe tải.",
    ],
    ["hợp-đồng", "long-term"],
  );
  // Câu đáp án đặt sát CUỐI trang (kiểm chunk không vắt trang).
  const tail = at(
    50,
    772,
    "Mọi tranh chấp được giải quyết tại tòa án nơi đặt kho.",
  );
  return { width: W, height: H, texts: [...head.texts, ...body.texts, tail] };
}

function pageTwo(): FixturePage {
  const title = at(
    50,
    50,
    "ĐIỀU 3 VÀ ĐIỀU 4: NGHĨA VỤ CỦA HAI BÊN TRONG THỜI GIAN THUÊ KHO",
  );
  const left = paragraphs(50, 90, 230, [
    "Điều 3. Nghĩa vụ bên thuê.",
    "Bên thuê trả phí thuê trước ngày mười của tháng đầu mỗi quý và giữ kho sạch sẽ, khô ráo.",
    "Bên thuê không được chứa hóa chất dễ cháy trong kho.",
  ]);
  const right = paragraphs(320, 90, 230, [
    "Điều 4. Nghĩa vụ bên cho thuê.",
    "Bên cho thuê bảo trì mái kho, hệ thống điện và bình chữa cháy theo đúng lịch đã thỏa thuận.",
    "Bên cho thuê báo trước ba mươi ngày nếu muốn tăng phí.",
  ]);
  return {
    width: W,
    height: H,
    texts: [title, ...left.texts, ...right.texts],
  };
}

const TABLE_RIGHTS = [330, 500];
const TABLE_ROWS: readonly (readonly string[])[] = [
  ["Quý", "Diện tích (m2)", "Phí thuê (triệu đồng)"],
  ["Quý 1", "1.150", "80,5"],
  ["Quý 2", "1.200", "84,0"],
  ["Quý 3", "1.250", "87,5"],
  ["Quý 4", "1.200", "84,0"],
  ["Cả năm", "4.800", "336,0"],
];

function pageThree(): FixturePage {
  const intro = paragraphs(50, 60, 500, [
    "Bảng phí thuê kho theo từng quý của năm đầu tiên được ghi dưới đây.",
  ]);
  const y0 = intro.next;
  const step = 14;
  const texts = TABLE_ROWS.flatMap((row, i) => {
    const y = y0 + i * step;
    return [
      at(55, y, row[0]),
      ...row.slice(1).map((c, j) => rightAt(TABLE_RIGHTS[j], y, c)),
    ];
  });
  const top = y0 - 11;
  const bottom = top + TABLE_ROWS.length * step;
  const lines: FixtureLine[] = [
    ...Array.from({ length: TABLE_ROWS.length + 1 }, (_, i) => ({
      x1: 45,
      y1: top + i * step,
      x2: 510,
      y2: top + i * step,
    })),
    ...[45, 200, 345, 510].map((x) => ({ x1: x, y1: top, x2: x, y2: bottom })),
  ];
  const outro = paragraphs(50, bottom + 30, 500, [
    "Phí thuê đã gồm tiền điện chiếu sáng nhưng chưa gồm tiền điện cho máy lạnh.",
  ]);
  return {
    width: W,
    height: H,
    texts: [...intro.texts, ...texts, ...outro.texts],
    lines,
  };
}

function pageFour(): FixturePage {
  // Trang khổ ngang 800×600 khi HIỂN THỊ; lưu dưới dạng /Rotate 90.
  const body = paragraphs(50, 60, 700, [
    "Phụ lục: lịch kiểm tra kho định kỳ",
    "Kho được kiểm tra phòng cháy vào ngày mười lăm của tháng cuối mỗi quý.",
    "Biên bản kiểm tra do hai bên cùng ký và lưu tại văn phòng khu công nghiệp.",
  ]);
  return rotateForDisplay({ width: 800, height: 600, texts: body.texts }, 90);
}

/** Bytes PDF fixture — thuần, tất định. */
export function buildEvalFixturePdf(): Uint8Array {
  return makePdf([pageOne(), pageTwo(), pageThree(), pageFour()]);
}
