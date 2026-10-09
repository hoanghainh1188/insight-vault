import type { Ref } from "react";
import type { Segment, ViewerBlock } from "./highlight";

// 147 (e): một bảng PDF dạng lưới — <table> có ngữ nghĩa (hàng tiêu đề, tên đọc), ô số căn phải, tô sáng theo ký tự trong ô (đoạn
// <mark>), bọc vùng cuộn ngang dùng được bằng bàn phím. Render React text node (không innerHTML).

type TableBlock = Extract<ViewerBlock, { kind: "table" }>;

interface SourceTableProps {
  block: TableBlock;
  /** Số thứ tự bảng (1-based) trong nguồn. */
  index: number;
  /** Tên đọc "Bảng {i} — trang {p}" (đã dịch). */
  label: string;
  /** Số [n] của trích dẫn — nhãn trên đoạn tô đầu tiên. */
  citationN: number | null;
  /** Ref cho đoạn tô đầu tiên (cuộn tới). */
  firstRef: Ref<HTMLElement>;
}

export function SegmentText({
  s,
  citationN,
  firstRef,
}: {
  s: Segment;
  citationN: number | null;
  firstRef: Ref<HTMLElement>;
}): JSX.Element {
  if (s.kind !== "highlight") return <span>{s.text}</span>;
  return (
    <mark className="hl" ref={s.first ? firstRef : undefined}>
      {s.first && citationN !== null && (
        <span className="hltag" data-testid="viewer-hltag">
          [{citationN}]
        </span>
      )}
      {s.text}
    </mark>
  );
}

export function SourceTable({
  block,
  index,
  label,
  citationN,
  firstRef,
}: SourceTableProps): JSX.Element {
  const numeric = block.table.numericColumns;
  const [head, ...body] = block.cells;
  const cell = (segs: Segment[]) =>
    segs.map((s, k) => (
      <SegmentText key={k} s={s} citationN={citationN} firstRef={firstRef} />
    ));
  return (
    <div
      className="vtable-wrap"
      role="region"
      tabIndex={0}
      aria-label={label}
      data-testid={`viewer-table-${index}`}
    >
      <table className="vtable" aria-label={label}>
        <thead>
          <tr>
            {head.map((segs, c) => (
              <th
                key={c}
                scope="col"
                className={numeric[c] ? "num" : undefined}
              >
                {cell(segs)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={r}>
              {row.map((segs, c) => (
                <td key={c} className={numeric[c] ? "num" : undefined}>
                  {cell(segs)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
