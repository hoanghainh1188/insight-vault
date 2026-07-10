import { NavLink } from "react-router-dom";

// Rail điều hướng trái (FR-005/006). 3 mục, active/hover. Route hash phản ánh khu vực (A2).
const ITEMS = [
  { to: "/notebooks", label: "Notebooks" },
  { to: "/workspace", label: "Workspace" },
  { to: "/settings", label: "Cài đặt" },
] as const;

export function NavRail(): JSX.Element {
  return (
    <nav className="nav-rail" aria-label="Điều hướng chính">
      <div className="nav-brand">IV</div>
      {ITEMS.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          data-testid={`nav-${it.to.slice(1)}`}
        >
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}
