import { AvatarNetwork, type Link } from "../landing/avatar-network";
import { Badge, Container } from "../landing/primitives";
import { WaitlistForm } from "../waitlist-form";

// The mission network is the Join Us one plus two links from portrait 5 across the gap
// (Figma 151:2152 and 151:2153).
const BRIDGES: Link[] = [
  [5, 10, 297, 167, 120, 3, 1.43, 120.037],
  [5, 16, 294, 178, 153, 95, 31.84, 180.094],
];

// Figma: Our Mission / Hero (134:1662 light, 164:519 dark).
export function MissionHero() {
  return (
    // 56px from the navbar to the body, which has another 48px of top padding.
    <section data-reveal-load="section" className="px-4 pt-14 pb-8">
      <Container className="flex flex-col items-center gap-12">
        <div
          data-reveal-load
          className="flex w-full max-w-[600px] flex-col items-center gap-8 pt-6 md:pt-12"
        >
          <div className="flex w-full flex-col items-center gap-4">
            <Badge tone="primary">Our Mission</Badge>
            <h1 className="text-center font-display font-medium text-[40px] text-text leading-[46px] tracking-[-0.8px] sm:text-[52px] sm:leading-[58px] sm:tracking-[-1.04px]">
              Elevating the craft of design, together.
            </h1>
            <p className="w-full max-w-[480px] text-center text-base text-text-secondary leading-[26px] tracking-[-0.08px]">
              Matrstudio replaces isolated learning with a peer-driven ecosystem, giving you the
              exact resources to master your craft.
            </p>
          </div>
          <WaitlistForm variant="primary" source="mission-hero" className="w-full items-center" />
        </div>
        <AvatarNetwork extraLinks={BRIDGES} onLoad />
      </Container>
    </section>
  );
}
