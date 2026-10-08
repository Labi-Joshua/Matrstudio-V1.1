import { AvatarNetwork } from "./avatar-network";
import { JoinDialogTrigger } from "./join-dialog";
import { Badge, Container } from "./primitives";

// Figma: Waitlist / Join Us (62:794).
export function JoinCta() {
  return (
    <section className="px-4 py-16">
      <Container className="flex flex-col items-center gap-12">
        <AvatarNetwork />
        {/* Spacing per Figma: badge→headline 16px, headline→body 16px, body→button 32px. */}
        <div data-reveal className="relative flex w-full flex-col items-center">
          <Badge tone="primary">Join Us</Badge>
          <h2 className="mt-4 text-center font-display font-medium text-[32px] text-text leading-10 tracking-[-0.64px]">
            Your design career, accelerated.
          </h2>
          <p className="mt-4 w-full max-w-[480px] text-center text-base text-text-secondary leading-[26px] tracking-[-0.08px]">
            We are opening our doors to a new era of collaborative design education. Secure your
            spot in the early access queue.
          </p>
          <JoinDialogTrigger
            source="waitlist-cta"
            className="relative mt-8 overflow-hidden rounded-full bg-primary px-3.5 py-2.5 font-medium text-sm text-white leading-5 tracking-[-0.14px] transition-all duration-500 ease-smooth before:absolute before:inset-y-0 before:-left-1/2 before:w-1/3 before:skew-x-[-20deg] before:bg-white/35 before:transition-[left] before:duration-700 before:ease-smooth hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-8px_rgba(214,92,31,0.7)] hover:before:left-[130%] active:translate-y-0 active:scale-[0.97]"
          >
            Be a part of the community
          </JoinDialogTrigger>
        </div>
      </Container>
    </section>
  );
}
