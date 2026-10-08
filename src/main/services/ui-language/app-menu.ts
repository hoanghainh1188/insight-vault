import type { MenuItemConstructorOptions } from "electron";
import type { Translator } from "@shared/i18n";

// 145: menu ứng dụng của hệ điều hành theo ngôn ngữ giao diện — hàm THUẦN dựng template (main gọi Menu.buildFromTemplate lúc
// khởi động và mỗi khi đổi ngôn ngữ). Chỉ dùng `role` chuẩn (phím tắt hệ điều hành: sao chép/dán, zoom, thoát…) với nhãn đã
// dịch; KHÔNG có mục click tự viết, KHÔNG có "Learn More" trỏ ra ngoài (local-first). DevTools/Reload chỉ ở bản chưa đóng gói.

export interface AppMenuOptions {
  platform: NodeJS.Platform;
  isPackaged: boolean;
  appName: string;
}

export function appMenuTemplate(
  t: Translator,
  opts: AppMenuOptions,
): MenuItemConstructorOptions[] {
  const m = (key: Parameters<Translator["t"]>[0]) =>
    t.t(key, { app: opts.appName } as never);
  const sep: MenuItemConstructorOptions = { type: "separator" };
  const mac = opts.platform === "darwin";

  const appMenu: MenuItemConstructorOptions = {
    label: opts.appName,
    submenu: [
      { role: "about", label: m("menu.about") },
      sep,
      { role: "hide", label: m("menu.hide") },
      { role: "hideOthers", label: m("menu.hideOthers") },
      { role: "unhide", label: m("menu.unhide") },
      sep,
      { role: "quit", label: m("menu.quit") },
    ],
  };
  const file: MenuItemConstructorOptions = {
    label: m("menu.file"),
    submenu: mac
      ? [{ role: "close", label: m("menu.close") }]
      : [
          { role: "close", label: m("menu.close") },
          { role: "quit", label: m("menu.quit") },
        ],
  };
  const edit: MenuItemConstructorOptions = {
    label: m("menu.edit"),
    submenu: [
      { role: "undo", label: m("menu.undo") },
      { role: "redo", label: m("menu.redo") },
      sep,
      { role: "cut", label: m("menu.cut") },
      { role: "copy", label: m("menu.copy") },
      { role: "paste", label: m("menu.paste") },
      { role: "selectAll", label: m("menu.selectAll") },
    ],
  };
  const view: MenuItemConstructorOptions = {
    label: m("menu.view"),
    submenu: [
      ...(opts.isPackaged
        ? []
        : [
            { role: "reload", label: m("menu.reload") } as const,
            { role: "toggleDevTools", label: m("menu.devTools") } as const,
            sep,
          ]),
      { role: "resetZoom", label: m("menu.resetZoom") },
      { role: "zoomIn", label: m("menu.zoomIn") },
      { role: "zoomOut", label: m("menu.zoomOut") },
      sep,
      { role: "togglefullscreen", label: m("menu.fullscreen") },
    ],
  };
  const window: MenuItemConstructorOptions = {
    label: m("menu.window"),
    submenu: mac
      ? [
          { role: "minimize", label: m("menu.minimize") },
          { role: "zoom", label: m("menu.zoom") },
          sep,
          { role: "front", label: m("menu.front") },
        ]
      : [{ role: "minimize", label: m("menu.minimize") }],
  };
  return mac ? [appMenu, file, edit, view, window] : [file, edit, view, window];
}
