// Khung nội dung rỗng cho từng khu vực (FR-006/007). Màn thật thuộc feature sau.
function Placeholder({
  title,
  hint,
}: {
  title: string;
  hint: string;
}): JSX.Element {
  return (
    <section
      className="placeholder"
      data-testid={`placeholder-${title.toLowerCase()}`}
    >
      <h2>{title}</h2>
      <p>{hint}</p>
    </section>
  );
}

export const NotebooksPlaceholder = (): JSX.Element => (
  <Placeholder
    title="Notebooks"
    hint="Danh sách notebook sẽ xuất hiện ở đây (feature sau)."
  />
);
export const WorkspacePlaceholder = (): JSX.Element => (
  <Placeholder
    title="Workspace"
    hint="Không gian 3 cột Nguồn / Chat / Studio (feature sau)."
  />
);
export const SettingsPlaceholder = (): JSX.Element => (
  <Placeholder
    title="Settings"
    hint="Mô hình AI, provider, lưu trữ cục bộ (feature sau)."
  />
);
