import { NavLink } from "react-router-dom";
import { IconNotebooks, IconWorkspace, IconSettings } from "../../shared/icons";

// Rail điều hướng trái (023-ui-polish B): rail dọc gọn bằng biểu tượng (prototype). Mục Cài đặt đẩy xuống
// đáy bằng spacer. Mỗi mục có aria-label/title (nhãn trợ năng) + SVG inline. Route hash giữ nguyên (A2).
type Item = {
  to: string;
  label: string;
  Icon: (p: { size?: number }) => JSX.Element;
};

const TOP: Item[] = [
  { to: "/notebooks", label: "Notebooks", Icon: IconNotebooks },
  { to: "/workspace", label: "Workspace", Icon: IconWorkspace },
];
const BOTTOM: Item[] = [
  { to: "/settings", label: "Cài đặt", Icon: IconSettings },
];

function railLink({ to, label, Icon }: Item): JSX.Element {
  return (
    <NavLink
      key={to}
      to={to}
      className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
      data-testid={`nav-${to.slice(1)}`}
      aria-label={label}
      title={label}
    >
      <Icon size={20} />
    </NavLink>
  );
}

export function NavRail(): JSX.Element {
  return (
    <nav className="nav-rail" aria-label="Điều hướng chính">
      <div className="nav-brand" aria-hidden="true">
        IV
      </div>
      <div className="nav-group">{TOP.map(railLink)}</div>
      <div className="nav-spacer" />
      <div className="nav-group">{BOTTOM.map(railLink)}</div>
    </nav>
  );
}
