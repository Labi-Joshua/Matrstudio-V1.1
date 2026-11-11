import type { ReactNode } from "react";
import { SettingsShell } from "../../../components/app-settings/settings-shell";

/** /settings/*: the title and section menu around each Settings section (Figma 10 to 15). */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <SettingsShell>{children}</SettingsShell>;
}
