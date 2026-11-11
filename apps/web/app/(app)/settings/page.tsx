import { RedirectToAccount } from "../../../components/app-settings/redirect";

/** /settings has no content of its own: it opens Account. */
export default function SettingsIndexPage() {
  return <RedirectToAccount />;
}
