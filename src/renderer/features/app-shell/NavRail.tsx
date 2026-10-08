import { NavLink } from "react-router-dom";
import type { Translator } from "@shared/i18n";
import { IconNotebooks, IconWorkspace, IconSettings } from "../../shared/icons";
import { useT } from "../../shared/i18n/i18n-context";

// Rail điều hướng trái (023-ui-polish B): rail dọc gọn bằng biểu tượng (prototype). Mục Cài đặt đẩy xuống
// đáy bằng spacer. Mỗi mục có aria-label/title (nhãn trợ năng) + SVG inline. Route hash giữ nguyên (A2).
// 123: nhãn là khoá dịch, dịch lúc render (đổi ngôn ngữ lúc chạy).
type Item = {
  to: string;
  labelKey: "app.nav.notebooks" | "app.nav.workspace" | "settings.title";
  Icon: (p: { size?: number }) => JSX.Element;
};

const TOP: Item[] = [
  { to: "/notebooks", labelKey: "app.nav.notebooks", Icon: IconNotebooks },
  { to: "/workspace", labelKey: "app.nav.workspace", Icon: IconWorkspace },
];
const BOTTOM: Item[] = [
  { to: "/settings", labelKey: "settings.title", Icon: IconSettings },
];

function railLink({ to, labelKey, Icon }: Item, t: Translator): JSX.Element {
  const label = t.t(labelKey);
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
  const t = useT();
  return (
    <nav className="nav-rail" aria-label={t.t("app.nav.main")}>
      <div className="nav-brand" aria-hidden="true">
        IV
      </div>
      <div className="nav-group">{TOP.map((i) => railLink(i, t))}</div>
      <div className="nav-spacer" />
      <div className="nav-group">{BOTTOM.map((i) => railLink(i, t))}</div>
    </nav>
  );
}
