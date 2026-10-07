import { Community } from "../components/landing/community";
import { Features } from "../components/landing/features";
import { Hero } from "../components/landing/hero";
import { JoinCta } from "../components/landing/join-cta";
import { SiteFooter } from "../components/landing/site-footer";
import { SiteHeader } from "../components/landing/site-header";
import { Testimonials } from "../components/landing/testimonials";

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
    </>
  );
}
