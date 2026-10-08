import { Badge, Container, ThemedImg } from "../landing/primitives";
import { WaitlistForm } from "../waitlist-form";

// Figma: Our Mission / Join the Community (134:2082 light, 164:690 dark).
export function MissionJoin() {
  return (
    <section data-reveal="section" className="px-4 py-8">
      <Container className="flex flex-col items-center gap-[58px] py-8">
        <div data-reveal className="flex w-full max-w-[600px] flex-col items-center gap-4">
          <Badge tone="primary">Join the Community</Badge>
          <h2 className="text-center font-display font-medium text-[28px] text-text leading-9 tracking-[-0.56px] sm:text-[32px] sm:leading-10 sm:tracking-[-0.64px]">
            We’re building the definitive hub to learn, build, and scale.
          </h2>
        </div>
        <div aria-hidden data-reveal="fade" className="w-full max-w-[655.462px]">
          <ThemedImg
            name="mission-globe.svg"
            width={655.462}
            height={213.636}
            className="block h-auto w-full"
          />
        </div>
        <div data-reveal className="flex w-full justify-center">
          <WaitlistForm variant="primary" source="mission-join" className="w-full items-center" />
        </div>
      </Container>
    </section>
  );
}
