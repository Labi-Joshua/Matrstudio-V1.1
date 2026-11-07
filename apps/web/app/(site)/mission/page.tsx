import {
  MissionCta,
  MissionHero,
  MissionPrinciples,
  MissionShowcase,
  MissionYardstick,
} from "../../../components/pages/company/mission-sections";
import { ROUTES } from "../../../lib/routes";
import { pageMeta } from "../../../lib/site";

export const metadata = pageMeta({
  title: "Our mission | Matr Studio",
  description:
    "Matr Studio turns the best free resources on the web into clear learning paths, so anyone can master their craft without a paywall.",
  path: ROUTES.mission,
});

// Figma "Marketing pages (V3)": Page · Our mission 778:7902.
export default function MissionPage() {
  return (
    <main>
      <MissionHero />
      <MissionYardstick />
      <MissionPrinciples />
      <MissionShowcase />
      <MissionCta />
    </main>
  );
}
