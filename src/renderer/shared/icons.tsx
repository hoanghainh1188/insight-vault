import type { SVGProps } from "react";

// Icon nội bộ — hand-inline SVG (023-ui-polish, R6). KHÔNG thư viện/CDN (Constitution I: local-first,
// không egress). Dùng currentColor + stroke để thừa hưởng màu chữ. aria-hidden mặc định (icon trang trí;
// nhãn ngữ nghĩa đặt ở nút cha qua aria-label).

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, ...rest }: IconProps): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
    ...rest,
  };
}

export function IconNotebooks(p: IconProps): JSX.Element {
  return (
    <svg {...base(p)}>
      <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" />
      <path d="M5 4a2 2 0 0 0-2 2v11" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

export function IconWorkspace(p: IconProps): JSX.Element {
  return (
    <svg {...base(p)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16M15 4v16" />
    </svg>
  );
}

export function IconSettings(p: IconProps): JSX.Element {
  // Bánh răng (cog) — phân biệt rõ với nút sáng/tối (không dùng dạng tia mặt trời).
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.05.05a2 2 0 1 1-2.83 2.83l-.05-.05a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47V21a2 2 0 0 1-4 0v-.06a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.47-.97H3a2 2 0 0 1 0-4h.06A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.32-1.77l-.05-.05a2 2 0 1 1 2.83-2.83l.05.05A1.6 1.6 0 0 0 9 4.6a1.6 1.6 0 0 0 .97-1.47V3a2 2 0 0 1 4 0v.06A1.6 1.6 0 0 0 15 4.6a1.6 1.6 0 0 0 1.77-.32l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05A1.6 1.6 0 0 0 19.4 9v.06a1.6 1.6 0 0 0 1.47.97H21a2 2 0 0 1 0 4h-.06a1.6 1.6 0 0 0-1.47.97Z" />
    </svg>
  );
}

export function IconSend(p: IconProps): JSX.Element {
  return (
    <svg {...base(p)}>
      <path d="M4 12l16-8-6 16-3-6-7-2Z" />
    </svg>
  );
}

export function IconSearch(p: IconProps): JSX.Element {
  return (
    <svg {...base(p)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

export function IconPlus(p: IconProps): JSX.Element {
  return (
    <svg {...base(p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconUpload(p: IconProps): JSX.Element {
  return (
    <svg {...base(p)}>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  );
}

export function IconClose(p: IconProps): JSX.Element {
  return (
    <svg {...base(p)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
