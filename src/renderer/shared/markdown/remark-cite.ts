import type { Root, Text } from "mdast";
import { visit, SKIP } from "unist-util-visit";

// remark plugin (029): tách token [n] trong các text node thành phần tử <cite-chip data-n>. Chạy SAU remark-gfm
// (trên mdast, TRƯỚC khi sang hast) → chip [n] hoạt động cả trong đoạn văn, danh sách, ô bảng. KHÔNG duyệt
// nội dung inlineCode/code (remark lưu chúng dưới node riêng, không phải `text`) → [n] trong mã giữ literal.
// MarkdownContent map "cite-chip" → nút bấm mở Source Viewer. n giới hạn 6 chữ số (số quá lớn → giữ literal).

const CITE_RE = /\[(\d{1,6})\]/g;

// mdast không có sẵn kiểu cho node tuỳ biến — mô tả tối thiểu để dựng hast qua data.hName/hProperties.
interface CiteNode {
  type: "cite";
  data: { hName: "cite-chip"; hProperties: { dataN: number } };
  children: Text[];
}

type SplitPart = Text | CiteNode;

/** Trả về plugin unified; transform mọi text node chứa [n] thành chuỗi text + cite xen kẽ. */
export function remarkCite() {
  return (tree: Root): void => {
    visit(tree, "text", (node: Text, index, parent) => {
      if (index == null || parent == null) return;
      const value = node.value;
      CITE_RE.lastIndex = 0;
      if (!CITE_RE.test(value)) return;

      CITE_RE.lastIndex = 0;
      const parts: SplitPart[] = [];
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = CITE_RE.exec(value)) !== null) {
        if (m.index > last) {
          parts.push({ type: "text", value: value.slice(last, m.index) });
        }
        const n = Number(m[1]);
        parts.push({
          type: "cite",
          data: { hName: "cite-chip", hProperties: { dataN: n } },
          children: [{ type: "text", value: String(n) }],
        });
        last = m.index + m[0].length;
      }
      if (last < value.length) {
        parts.push({ type: "text", value: value.slice(last) });
      }

      // Thay text node gốc bằng các phần đã tách; tiếp tục duyệt SAU cụm mới chèn (không xử lý lại).
      parent.children.splice(index, 1, ...(parts as unknown as Text[]));
      return [SKIP, index + parts.length];
    });
  };
}
