import { ROUTES } from "../routes";

/** The four Settings sections (Figma "Settings: account" and its siblings), in menu order. */
export type SettingsSectionId = "account" | "notifications" | "learning" | "appearance";

export const SETTINGS_SECTIONS: readonly { id: SettingsSectionId; label: string; href: string }[] =
  [
    { id: "account", label: "Account", href: ROUTES.settingsAccount },
    { id: "notifications", label: "Notifications and emails", href: ROUTES.settingsNotifications },
    { id: "learning", label: "Learning preferences", href: ROUTES.settingsLearning },
    { id: "appearance", label: "Appearance and privacy", href: ROUTES.settingsAppearance },
  ];

const trim = (path: string) => (path.length > 1 ? path.replace(/\/+$/, "") : path);

/** The section a pathname belongs to; Account for anything under /settings that is not listed. */
export function sectionFromPath(pathname: string): SettingsSectionId {
  const here = trim(pathname);
  return SETTINGS_SECTIONS.find((s) => here === s.href)?.id ?? "account";
}
