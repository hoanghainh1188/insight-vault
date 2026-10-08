import type { Messages } from "./translate";

// 123 — bản English (bản dịch phát sinh từ vi.ts; thuật ngữ theo cột English của docs/00-glossary.md).

export const en: Messages = {
  common: {
    cancel: "Cancel",
    close: "Close",
    save: "Save",
    retry: "Retry",
    delete: "Delete",
    copy: "Copy",
    copied: "Copied",
  },
  time: {
    justNow: "just now",
    minutesAgo: { one: "{count} minute ago", other: "{count} minutes ago" },
    hoursAgo: { one: "{count} hour ago", other: "{count} hours ago" },
    yesterday: "yesterday",
    daysAgo: { one: "{count} day ago", other: "{count} days ago" },
    lastWeek: "last week",
  },
  errors: {
    unexpected: "Something went wrong. Please try again.",
  },
  settings: {
    title: "Settings",
    language: {
      title: "Language",
      description:
        "Interface language. Chat answers follow the language of your question; Studio follows the interface language.",
      auto: "Automatic (system language)",
      saveFailed: "Couldn't change the language. Please try again.",
    },
  },
};
