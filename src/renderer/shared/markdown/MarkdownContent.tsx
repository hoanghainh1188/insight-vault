import { Fragment, useMemo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Citation } from "@shared/ipc/types";
import { formatCitationLabel } from "../../features/rag-qa/citation-format";
import { remarkCite } from "./remark-cite";
import "./markdown.css";

// Render markdown (029) bằng react-markdown — đúng chuẩn CommonMark/GFM (xuống dòng, list lồng, bảng…),
// dựng CHỈ React node (react-markdown KHÔNG bật rehype-raw → HTML/script trong nội dung LLM giữ literal,
// XSS-safe by construction). Chip [n] giữ hành vi mở Source Viewer (013/019) qua remarkCite + component
// "cite-chip". Link render text (local-first, không điều hướng ra ngoài).

const REMARK_PLUGINS = [remarkGfm, remarkCite];

// Giới hạn độ dài đưa vào parser (defense-in-depth chống DoS — nội dung LLM dài bất thường). ~40k ký tự đủ
// cho câu trả lời/tổng hợp thực tế; dài hơn → cắt + ghi chú.
const MAX_MARKDOWN_LENGTH = 40000;

/** Đọc số trích dẫn từ hast node do remarkCite dựng (hProperties.dataN). */
function citeNumberFromNode(node: unknown): number {
  const props = (node as { properties?: Record<string, unknown> })?.properties;
  return Number(props?.dataN ?? props?.["data-n"]);
}

function buildComponents(
  citeByN: Map<number, Citation>,
  onCite: ((c: Citation) => void) | undefined,
): Components {
  const map: Record<string, (props: Record<string, unknown>) => ReactNode> = {
    // Hạ bậc heading trong ngữ cảnh bong bóng/thẻ (h1→h4…) nhưng giữ phân cấp thị giác qua .md-h1/2/3.
    h1: ({ children }) => <h4 className="md-h1">{children as ReactNode}</h4>,
    h2: ({ children }) => <h5 className="md-h2">{children as ReactNode}</h5>,
    h3: ({ children }) => <h6 className="md-h3">{children as ReactNode}</h6>,
    h4: ({ children }) => <h6 className="md-h3">{children as ReactNode}</h6>,
    h5: ({ children }) => <h6 className="md-h3">{children as ReactNode}</h6>,
    h6: ({ children }) => <h6 className="md-h3">{children as ReactNode}</h6>,
    p: ({ children }) => <p className="md-p">{children as ReactNode}</p>,
    ul: ({ children }) => <ul className="md-ul">{children as ReactNode}</ul>,
    ol: ({ children }) => <ol className="md-ol">{children as ReactNode}</ol>,
    pre: ({ children }) => (
      <pre className="md-pre">{children as ReactNode}</pre>
    ),
    // Link: chỉ hiển thị chữ, KHÔNG mở ra ngoài (Constitution I — local-first, không egress ngoài ý muốn).
    a: ({ children }) => (
      <span className="md-link">{children as ReactNode}</span>
    ),
    // Chip trích dẫn [n] do remarkCite chèn.
    "cite-chip": ({ node }) => {
      const n = citeNumberFromNode(node);
      const c = citeByN.get(n);
      if (!c) return <Fragment>{`[${n}]`}</Fragment>;
      return (
        <button
          type="button"
          className="cite"
          title={formatCitationLabel(c)}
          onClick={() => onCite?.(c)}
          data-testid={`cite-${n}`}
        >
          {n}
        </button>
      );
    },
  };
  // "cite-chip" không thuộc keyof JSX.IntrinsicElements → cast để react-markdown nhận component tuỳ biến.
  return map as unknown as Components;
}

export function MarkdownContent({
  content,
  citeByN,
  onCite,
}: {
  content: string;
  citeByN: Map<number, Citation>;
  onCite?: (c: Citation) => void;
}): JSX.Element {
  const tooLong = content.length > MAX_MARKDOWN_LENGTH;
  const text = tooLong ? content.slice(0, MAX_MARKDOWN_LENGTH) : content;
  const components = useMemo(
    () => buildComponents(citeByN, onCite),
    [citeByN, onCite],
  );
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={components}>
        {text}
      </ReactMarkdown>
      {tooLong && (
        <p className="md-truncated" data-testid="md-truncated">
          (Nội dung dài đã được rút gọn khi hiển thị.)
        </p>
      )}
    </div>
  );
}
