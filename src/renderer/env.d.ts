import type { Api } from "../preload/index";

// window.api do preload expose (contextBridge). Renderer chỉ dùng qua đây, không có Node/FS.
declare global {
  interface Window {
    api: Api;
  }
}

export {};
