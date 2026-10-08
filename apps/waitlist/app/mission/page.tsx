import { JoinDialog } from "../../components/landing/join-dialog";
import { SiteFooter } from "../../components/landing/site-footer";
import { SiteHeader } from "../../components/landing/site-header";
import { MissionHero } from "../../components/mission/mission-hero";
import { MissionJoin } from "../../components/mission/mission-join";
import { Yardstick } from "../../components/mission/yardstick";
import { RevealObserver } from "../../components/reveal-observer";

export const metadata = {
  title: "Our Mission | Matr Studio",
  description:
    "Matrstudio replaces isolated learning with a peer-driven ecosystem, giving product designers the exact resources to master their craft.",
  alternates: { canonical: "/mission" },
};

// Figma: MatrStudio V 1.1 / Our Mission (134:1661 light, 164:518 dark).
export default function MissionPage() {
  return (
    <>
      <SiteHeader current="mission" />
      <main>
        <MissionHero />
        <Yardstick />
        <MissionJoin />
      </main>
      <SiteFooter />
      <JoinDialog />
      <RevealObserver />
    </>
  );
}
