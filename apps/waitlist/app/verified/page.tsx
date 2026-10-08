import { AvatarNetwork, BRIDGE_LINKS } from "../../components/landing/avatar-network";
import { Badge, Container } from "../../components/landing/primitives";
import { SiteFooter } from "../../components/landing/site-footer";
import { LogoHeader } from "../../components/landing/site-header";
import { RevealObserver } from "../../components/reveal-observer";

// Landing page for confirmation-email links: keep it out of search results.
export const metadata = {
  title: "You’re on the list | Matr Studio",
  robots: { index: false, follow: false },
};

// Figma: MatrStudio V 1.1 / Email Confirmation (171:5071 light, 174:165 dark).
export default function VerifiedPage() {
  return (
    <>
      <LogoHeader />
      <main>
        {/* 56px from the navbar to the body, which has another 48px of top padding. */}
        <section data-reveal-load="section" className="px-4 pt-14 pb-8">
          <Container className="flex flex-col items-center gap-12">
            <div
              data-reveal-load
              className="flex w-full max-w-[640px] flex-col items-center gap-4 pt-6 md:pt-12"
            >
              <Badge tone="primary">Your email has been verified</Badge>
              <h1 className="text-center font-display font-medium text-[36px] text-text leading-[44px] tracking-[-0.72px] sm:text-[48px] sm:leading-[58px] sm:tracking-[-0.96px]">
                {/* The emoji never wraps on its own (emoji fonts are wider on Windows than in Figma). */}
                You’re now on the <span className="whitespace-nowrap">waitlist🎊</span>
              </h1>
              <p className="w-full max-w-[480px] text-center text-base text-text-secondary leading-[26px] tracking-[-0.08px]">
                Welcome to the community. Your email has been confirmed and we’ll be in touch once
                Matr Studio launches.
              </p>
            </div>
            <AvatarNetwork extraLinks={BRIDGE_LINKS} onLoad />
          </Container>
        </section>
      </main>
      <SiteFooter />
      <RevealObserver />
    </>
  );
}
