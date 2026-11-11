import { AccessScreen } from "../components/shell/access-screen";
import { ThemeInit } from "../components/ui/theme";

export const metadata = { title: "Page not found | Matr Studio admin" };

/** Static-export 404: no session lookup here, so it works signed in or out. */
export default function NotFound() {
  return (
    <main className="min-h-dvh bg-bg-base text-text">
      <ThemeInit />
      <AccessScreen kind="not_found" />
    </main>
  );
}
