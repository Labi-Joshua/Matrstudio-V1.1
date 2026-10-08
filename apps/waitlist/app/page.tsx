import { Community } from "../components/landing/community";
import { Features } from "../components/landing/features";
import { Hero } from "../components/landing/hero";
import { JoinCta } from "../components/landing/join-cta";
import { JoinDialog } from "../components/landing/join-dialog";
import { SiteFooter } from "../components/landing/site-footer";
import { SiteHeader } from "../components/landing/site-header";
import { Testimonials } from "../components/landing/testimonials";
import { RevealObserver } from "../components/reveal-observer";

// Figma: MatrStudio V 1.1 / Waitlist (62:542), light mode.
export default function Page() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Features />
        <Testimonials />
        <Community />
        <JoinCta />
      </main>
      <SiteFooter />
      {/* One shared waitlist modal, opened by the navbar and CTA buttons. */}
      <JoinDialog />
      {/* Starts the scroll-in entrances; renders nothing. */}
      <RevealObserver />
    </>
  );
}
