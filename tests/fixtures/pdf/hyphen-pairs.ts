// 147 (a, research R6, clarify #16–#20, SC-004): tập cặp dòng gắn nhãn cho quyết định gạch nối cuối dòng.
// `prev` kết thúc bằng gạch (hoặc U+2010 / U+2011 / U+00AD), `next` là dòng kế; `expected` = văn bản đúng sau khi nối.
// `context` = các dòng khác trong CÙNG tài liệu (bằng chứng: từ có gạch / từ liền đã gặp). Không dùng từ điển.

export interface HyphenPair {
  prev: string;
  next: string;
  expected: string;
  context?: string[];
  lang: "en" | "vi" | "other";
  note: string;
}

const SOFT = "\u00AD";
const U2010 = "\u2010";
const U2011 = "\u2011";

export const HYPHEN_PAIRS: readonly HyphenPair[] = [
  // — ngắt từ thật, không bằng chứng ⇒ nối liền (hành vi cũ)
  {
    prev: "the infor-",
    next: "mation flow",
    expected: "the information flow",
    lang: "en",
    note: "ngắt thật",
  },
  {
    prev: "a hyphen-",
    next: "ated word",
    expected: "a hyphenated word",
    lang: "en",
    note: "ngắt thật",
  },
  {
    prev: "this docu-",
    next: "ment is",
    expected: "this document is",
    lang: "en",
    note: "ngắt thật",
  },
  {
    prev: "data pro-",
    next: "cessing step",
    expected: "data processing step",
    lang: "en",
    note: "ngắt thật",
  },
  {
    prev: "risk manage-",
    next: "ment plan",
    expected: "risk management plan",
    lang: "en",
    note: "ngắt thật",
  },
  {
    prev: "an inter-",
    next: "national team",
    expected: "an international team",
    lang: "en",
    note: "ngắt thật",
  },
  {
    prev: "better under-",
    next: "standing of",
    expected: "better understanding of",
    lang: "en",
    note: "ngắt thật",
  },
  {
    prev: "machine transla-",
    next: "tion quality",
    expected: "machine translation quality",
    lang: "en",
    note: "ngắt thật",
  },
  // — ngắt thật CÓ bằng chứng dạng liền ⇒ nối liền
  {
    prev: "the infor-",
    next: "mation flow",
    expected: "the information flow",
    context: ["Information is key."],
    lang: "en",
    note: "bằng chứng liền",
  },
  {
    prev: "all docu-",
    next: "ments were",
    expected: "all documents were",
    context: ["The documents are signed."],
    lang: "en",
    note: "bằng chứng liền",
  },
  {
    prev: "we co-",
    next: "operate with",
    expected: "we cooperate with",
    context: ["They cooperate closely."],
    lang: "en",
    note: "bằng chứng liền",
  },
  {
    prev: "the re-",
    next: "sults show",
    expected: "the results show",
    context: ["Results vary by region."],
    lang: "en",
    note: "bằng chứng liền",
  },
  // — từ ghép CÓ bằng chứng dạng gạch trong tài liệu ⇒ giữ gạch
  {
    prev: "our long-",
    next: "term plan",
    expected: "our long-term plan",
    context: ["We prefer a long-term view."],
    lang: "en",
    note: "bằng chứng gạch",
  },
  {
    prev: "a well-",
    next: "known fact",
    expected: "a well-known fact",
    context: ["It is well-known."],
    lang: "en",
    note: "bằng chứng gạch",
  },
  {
    prev: "the state-of-the-",
    next: "art model",
    expected: "the state-of-the-art model",
    context: ["A state-of-the-art system."],
    lang: "en",
    note: "bằng chứng gạch, ghép nhiều phần",
  },
  {
    prev: "a self-",
    next: "contained unit",
    expected: "a self-contained unit",
    context: ["Each module is self-contained."],
    lang: "en",
    note: "bằng chứng gạch",
  },
  {
    prev: "we co-",
    next: "operate with",
    expected: "we co-operate with",
    context: ["They co-operate closely."],
    lang: "en",
    note: "bằng chứng gạch",
  },
  {
    prev: "in real-",
    next: "time mode",
    expected: "in real-time mode",
    context: ["Real-time alerts are sent."],
    lang: "en",
    note: "bằng chứng gạch",
  },
  {
    prev: "for decision-",
    next: "making tools",
    expected: "for decision-making tools",
    context: ["Better decision-making helps."],
    lang: "en",
    note: "bằng chứng gạch",
  },
  // — bằng chứng mâu thuẫn (cả hai dạng) ⇒ mặc định (nối liền)
  {
    prev: "send an e-",
    next: "mail now",
    expected: "send an email now",
    context: ["Use e-mail.", "Or an email."],
    lang: "en",
    note: "mâu thuẫn ⇒ mặc định",
  },
  // — từ ghép KHÔNG có bằng chứng ⇒ mặc định nối liền (sai, như hành vi cũ — giới hạn đã biết)
  {
    prev: "a long-",
    next: "term plan",
    expected: "a long-term plan",
    lang: "en",
    note: "ghép không bằng chứng",
  },
  {
    prev: "of high-",
    next: "quality output",
    expected: "of high-quality output",
    lang: "en",
    note: "ghép không bằng chứng",
  },
  {
    prev: "un porte-",
    next: "monnaie neuf",
    expected: "un porte-monnaie neuf",
    lang: "other",
    note: "ghép không bằng chứng (Pháp)",
  },
  // — chữ HOA / số ⇒ giữ gạch
  {
    prev: "a Capital-",
    next: "Case word",
    expected: "a Capital-Case word",
    lang: "en",
    note: "chữ hoa",
  },
  {
    prev: "the Covid-",
    next: "19 wave",
    expected: "the Covid-19 wave",
    lang: "en",
    note: "số sau",
  },
  {
    prev: "a 3-",
    next: "dimensional view",
    expected: "a 3-dimensional view",
    lang: "en",
    note: "số trước",
  },
  {
    prev: "the pre-",
    next: "COVID era",
    expected: "the pre-COVID era",
    lang: "en",
    note: "chữ hoa",
  },
  {
    prev: "meets ISO-",
    next: "9001 rules",
    expected: "meets ISO-9001 rules",
    lang: "en",
    note: "số sau",
  },
  {
    prev: "in 2020-",
    next: "2021 season",
    expected: "in 2020-2021 season",
    lang: "en",
    note: "số hai bên",
  },
  // — gạch treo (liên từ sau) ⇒ giữ gạch + dấu cách
  {
    prev: "both pre-",
    next: "and post-war",
    expected: "both pre- and post-war",
    lang: "en",
    note: "gạch treo",
  },
  {
    prev: "for short-",
    next: "or long-term",
    expected: "for short- or long-term",
    lang: "en",
    note: "gạch treo",
  },
  {
    prev: "die Vor-",
    next: "und Nachteile",
    expected: "die Vor- und Nachteile",
    lang: "other",
    note: "gạch treo (Đức)",
  },
  {
    prev: "giai đoạn tiền-",
    next: "và hậu-kiểm",
    expected: "giai đoạn tiền- và hậu-kiểm",
    lang: "vi",
    note: "gạch treo (Việt)",
  },
  // — tiếng Việt ⇒ giữ gạch, nối liền (không bao giờ dính chữ)
  {
    prev: "bản hợp-",
    next: "đồng này",
    expected: "bản hợp-đồng này",
    lang: "vi",
    note: "Việt",
  },
  {
    prev: "tỉnh Bà Rịa-",
    next: "Vũng Tàu",
    expected: "tỉnh Bà Rịa-Vũng Tàu",
    lang: "vi",
    note: "Việt + chữ hoa",
  },
  {
    prev: "phát triển kinh-",
    next: "tế bền vững",
    expected: "phát triển kinh-tế bền vững",
    lang: "vi",
    note: "Việt",
  },
  {
    prev: "vấn đề xã-",
    next: "hội hiện nay",
    expected: "vấn đề xã-hội hiện nay",
    lang: "vi",
    note: "Việt",
  },
  {
    prev: "theo tiêu-",
    next: "chuẩn quốc gia",
    expected: "theo tiêu-chuẩn quốc gia",
    lang: "vi",
    note: "Việt",
  },
  {
    prev: "tuyến đường-",
    next: "sắt mới",
    expected: "tuyến đường-sắt mới",
    lang: "vi",
    note: "Việt",
  },
  {
    prev: "chiếc xe-",
    next: "đạp nhỏ",
    expected: "chiếc xe-đạp nhỏ",
    lang: "vi",
    note: "Việt (phía sau)",
  },
  {
    prev: "bản hợp-".normalize("NFD"),
    next: "đồng này".normalize("NFD"),
    expected: "bản hợp-đồng này".normalize("NFD"),
    lang: "vi",
    note: "Việt NFD",
  },
  // — ngôn ngữ khác có dấu mũ / trăng / đ / й (KHÔNG phải tiếng Việt) ⇒ hành vi 112 (nối liền)
  {
    prev: "le pâ-",
    next: "turage vert",
    expected: "le pâturage vert",
    lang: "other",
    note: "Pháp â",
  },
  {
    prev: "la fo-",
    next: "rêt noire",
    expected: "la forêt noire",
    lang: "other",
    note: "Pháp ê",
  },
  {
    prev: "надо перей-",
    next: "ти улицу",
    expected: "надо перейти улицу",
    lang: "other",
    note: "Nga й",
  },
  {
    prev: "limba ro-",
    next: "mână veche",
    expected: "limba română veche",
    lang: "other",
    note: "Rumani ă â",
  },
  {
    prev: "sretan rođ-",
    next: "endan svima",
    expected: "sretan rođendan svima",
    lang: "other",
    note: "Croatia đ",
  },
  {
    prev: "uma inter-",
    next: "nação longa",
    expected: "uma internação longa",
    lang: "other",
    note: "Bồ Đào Nha ã",
  },
  // — U+2010 / U+2011 (giữ đúng ký tự gốc khi giữ gạch)
  {
    prev: `our long${U2010}`,
    next: "term plan",
    expected: `our long${U2010}term plan`,
    context: ["A long-term view."],
    lang: "en",
    note: "U+2010 + bằng chứng",
  },
  {
    prev: `the infor${U2011}`,
    next: "mation flow",
    expected: "the information flow",
    lang: "en",
    note: "U+2011 ngắt thật",
  },
  {
    prev: `a Capital${U2010}`,
    next: "Case word",
    expected: `a Capital${U2010}Case word`,
    lang: "en",
    note: "U+2010 + chữ hoa",
  },
  // — gạch mềm U+00AD ⇒ luôn bỏ, nối liền
  {
    prev: `trích${SOFT}`,
    next: "xuất văn bản",
    expected: "tríchxuất văn bản",
    lang: "vi",
    note: "gạch mềm",
  },
  {
    prev: `infor${SOFT}`,
    next: "mation",
    expected: "information",
    context: ["A long-term view."],
    lang: "en",
    note: "gạch mềm",
  },
];
