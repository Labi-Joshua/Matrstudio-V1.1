import { cn } from "@matr/ui";
import type { ReactNode } from "react";
import { AvatarNetwork, BRIDGE_LINKS } from "../landing/avatar-network";
import { asset, Badge, Container } from "../landing/primitives";
import { SiteFooter } from "../landing/site-footer";
import { LogoHeader } from "../landing/site-header";
import { RevealObserver } from "../reveal-observer";
import { primaryButton, secondaryButton } from "./buttons";

// Figma: MatrStudio V 1.1 / Email Confirmation (171:5070): the pages a confirmation link lands
// on. Confirmed (171:5071), Link Expired (187:335), Link Not Recognised (187:1510) and Link
// Already Confirmed (187:2498), each with a dark frame. They share this layout: logo-only
// navbar, optional state icon, badge, headline, copy, actions, the avatar network and the footer.

type Tone = "warning" | "error" | "success";

const ICON_TILE: Record<Tone, string> = {
  warning: "bg-warning-accent border-warning-border",
  error: "bg-error-accent border-error-border",
  success: "bg-success-accent border-success-border",
};

export function VerifyState({
  icon,
  badge,
  title,
  children,
  actions,
}: {
  /** State icon in a tinted tile (none on the confirmed page). */
  icon?: { name: string; tone: Tone };
  badge: { label: string; tone: Tone | "primary" };
  title: ReactNode;
  /** Copy under the headline. */
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <>
      <LogoHeader />
      <main>
        {/* 56px from the navbar to the body, which has another 48px of top padding. */}
        <section data-reveal-load="section" className="px-4 pt-14 pb-8">
          <Container className="flex flex-col items-center gap-12">
            <div
              data-reveal-load
              className="flex w-full max-w-[640px] flex-col items-center gap-8 pt-6 md:pt-12"
            >
              <div className="flex w-full flex-col items-center gap-4">
                {icon && (
                  <span
                    className={cn(
                      "flex size-[58px] items-center justify-center rounded-xl border",
                      ICON_TILE[icon.tone],
                    )}
                  >
                    <img alt="" src={asset(icon.name)} width={28} height={28} className="size-7" />
                  </span>
                )}
                <Badge tone={badge.tone}>{badge.label}</Badge>
                <h1 className="text-center font-display font-medium text-[36px] text-text leading-[44px] tracking-[-0.72px] sm:text-[48px] sm:leading-[58px] sm:tracking-[-0.96px]">
                  {title}
                </h1>
                <p className="w-full max-w-[480px] text-center text-base text-text-secondary leading-[26px] tracking-[-0.08px]">
                  {children}
                </p>
              </div>
              {actions}
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

/** "Back to homepage →" and "Read our mission", used by the confirmed and already-confirmed pages. */
export function HomeAndMissionActions() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <a href="/" className={primaryButton}>
        Back to homepage
        <img
          alt=""
          src={asset("verify-arrow-right.svg")}
          width={20}
          height={20}
          className="size-5"
        />
      </a>
      <a href="/mission" className={secondaryButton}>
        Read our mission
      </a>
    </div>
  );
}
