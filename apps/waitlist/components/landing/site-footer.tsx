import { cn } from "@matr/ui";
import type { CSSProperties, ReactNode } from "react";
import { CursorParallax } from "./cursor-parallax";
import { asset, Container, canvas, parallax, ThemedImg } from "./primitives";
import { ThemeToggle } from "./theme-toggle";

// Figma: Waitlist / Footer (62:817). The logo composition is laid out on a 1240 x 478 canvas
// (everything above the utility bar). Badges inside logo-scale-frame are offset by (10, 106.273).
// There is no mobile frame: below lg only the community badge is kept, under the wordmark.
const comp = canvas(1240, 478);

function BadgeIcon({ name, className }: { name: string; className: string }) {
  return (
    <span
      className={cn(
        "flex size-[23.363px] shrink-0 items-center justify-center rounded-[5.841px]",
        className,
      )}
    >
      <ThemedImg name={name} className="block size-[13.628px]" />
    </span>
  );
}

function BadgeText({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <span className="flex flex-col items-start gap-[0.973px]">
      <span className="font-display font-semibold text-[9.735px] text-text leading-[12.655px]">
        {title}
      </span>
      {subtitle && (
        <span className="text-[8.761px] text-text-secondary leading-[11.682px]">{subtitle}</span>
      )}
    </span>
  );
}

const pill = "rounded-[11.682px] px-[7.788px] py-[5.841px]";

type FooterBadge = {
  id: string;
  className: string;
  /** Desktop position on the 1240 x 478 canvas. */
  at: [number, number];
  /** Desktop cursor parallax: px the badge drifts toward the cursor. */
  depth: number;
  /** Shown below lg (under the wordmark) only when set, with a small tilt. */
  mobile?: { rotate: number };
  content: ReactNode;
};

const BADGES: FooterBadge[] = [
  {
    id: "components",
    className: cn(pill, "border-primary-border bg-[#ffe8e0] dark:bg-primary-accent"),
    at: [300, 109],
    depth: 14,
    content: (
      <>
        <BadgeIcon name="icon-component.svg" className="bg-primary" />
        <BadgeText title="Reusable components" />
      </>
    ),
  },
  {
    id: "layers",
    className: cn(pill, "border-[#c7ccfa] bg-[#eef0ff] dark:border-[#623df5] dark:bg-[#25194d]"),
    at: [637, 112],
    depth: 18,
    content: (
      <>
        <BadgeIcon name="icon-layers-white.svg" className="bg-[#6e78f7] dark:bg-[#623df5]" />
        <BadgeText title="Layers & Theming" subtitle="Dark & light ready" />
      </>
    ),
  },
  {
    id: "design-system",
    className: cn(pill, "border-border bg-bg-fill1"),
    at: [-39, 196],
    depth: 10,
    content: (
      <>
        <span className="flex size-[19.469px] shrink-0 items-center justify-center rounded-full bg-primary-focus font-display font-semibold text-[11.68px] text-primary-text">
          A
        </span>
        <BadgeText title="Design System" subtitle="Components & Tokens" />
        <span className="rounded-[5.841px] bg-primary-focus px-[5.841px] py-[1.947px] font-display font-medium text-[11.68px] text-primary leading-[15.575px]">
          DS
        </span>
      </>
    ),
  },
  {
    id: "dev-exports",
    className: cn(pill, "border-[#7de0b0] bg-[#e8fff4] dark:border-[#218341] dark:bg-[#0f2e19]"),
    at: [188, 280],
    depth: 22,
    content: (
      <>
        <BadgeIcon name="icon-code.svg" className="bg-[#1da54a]" />
        <BadgeText title="Dev-ready Exports" subtitle="JSX & Tokens" />
      </>
    ),
  },
  {
    id: "color-tokens",
    className: cn(pill, "border-[#ffd98a] bg-[#fff5e0] dark:border-[#6e4d0c] dark:bg-[#2e240f]"),
    at: [1066, 144],
    depth: 16,
    content: (
      <>
        <BadgeIcon name="icon-palette.svg" className="bg-[#f5a623] dark:bg-[#ffaa00]" />
        <BadgeText title="Color Tokens" subtitle="Semantic palette" />
      </>
    ),
  },
  {
    id: "community",
    className: "rounded-[13.628px] border-border bg-bg-base px-[9.735px] py-[7.788px]",
    at: [746, 281],
    depth: 20,
    mobile: { rotate: 1 },
    content: (
      <>
        <span className="flex items-center">
          {["footer-avatar-1.jpg", "footer-avatar-2.jpg", "footer-avatar-3.jpg"].map((src, i) => (
            <img
              decoding="async"
              key={src}
              alt=""
              src={asset(src)}
              className={cn(
                "size-[15.162px] rounded-full border-[1.895px] border-bg-base object-cover",
                i < 2 && "mr-[-3.894px]",
              )}
            />
          ))}
        </span>
        <BadgeText title="Built by the community" subtitle="Made for designers" />
      </>
    ),
  },
];

const badgeBase =
  "flex items-center gap-[5.841px] whitespace-nowrap border-[0.973px] shadow-badge transition-[translate,rotate,scale,box-shadow] duration-500 ease-smooth";

function Wordmark({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <ThemedImg
      name="logo-wordmark.svg"
      alt="matrstudio."
      className={cn("block max-w-none", className)}
      style={style}
    />
  );
}

/** Below lg: the wordmark with just the "Built by the community" badge under it. */
function MobileComposition() {
  return (
    <div data-reveal className="flex flex-col items-center gap-7 pt-6 pb-10 lg:hidden">
      <Wordmark className="h-auto w-full" />
      {BADGES.filter((b) => b.mobile).map(({ id, className, mobile, content }) => (
        <div
          key={id}
          className={cn(
            badgeBase,
            "rotate-[var(--rot)] [zoom:1.15] hover:-translate-y-1 hover:rotate-0 hover:scale-105",
            className,
          )}
          style={{ "--rot": `${mobile?.rotate ?? 0}deg` } as CSSProperties}
        >
          {content}
        </div>
      ))}
    </div>
  );
}

/** lg and up: the Figma composition, scaled with its container. */
function DesktopComposition() {
  return (
    // Badges drift toward the cursor anywhere in the footer (same effect as the community arc).
    <CursorParallax className="hidden lg:block">
      <div data-reveal className="group/comp relative aspect-[1240/478] w-full">
        <Wordmark className="absolute" style={comp(10, 106.273, 1220, 192.817)} />
        {BADGES.map(({ id, className, at: [x, y], depth, content }, index) => {
          const style = comp(x, y);
          // Badges that hang outside the 1240 frame (x < 0) must not run off a narrow viewport:
          // (100% - 100vw) / 2 is the viewport edge relative to the centred container.
          if (x < 0) style.left = `max(${style.left}, calc((100% - 100vw) / 2 + 8px))`;
          return (
            <div
              key={id}
              className={cn(
                badgeBase,
                parallax,
                "absolute hover:z-10 hover:-rotate-3 hover:scale-110 group-hover/comp:animate-float",
                className,
              )}
              style={
                {
                  ...style,
                  "--depth": depth,
                  animationDelay: `${index * -0.4}s`,
                } as CSSProperties
              }
            >
              {content}
            </div>
          );
        })}
      </div>
    </CursorParallax>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="relative after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-500 hover:after:scale-x-100 flex items-center gap-1 font-medium text-sm text-text-secondary leading-5 tracking-[-0.14px] transition-colors duration-500 ease-smooth hover:text-text"
    >
      {children}
    </a>
  );
}

const Dot = () => (
  <span aria-hidden className="text-[13px] text-text">
    ·
  </span>
);

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden px-4 py-8">
      {/* Glows: Figma sizes from md up; smaller and pulled to the edges on phones. Dark mode uses
          the info/primary focus tints (Figma 164:759). */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-[-30%] bg-[radial-gradient(closest-side,rgba(194,219,255,0.55),rgba(194,219,255,0))] dark:bg-[radial-gradient(closest-side,#143352,rgba(20,51,82,0))] dark:opacity-55 h-[340px] w-[320px] md:top-[-8.27px] md:left-[8.28%] md:h-[484px] md:w-[449px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-35%] bottom-0 bg-[radial-gradient(closest-side,rgba(255,219,194,0.4),rgba(255,219,194,0))] dark:bg-[radial-gradient(closest-side,#522914,rgba(82,41,20,0))] dark:opacity-40 h-[380px] w-[350px] md:top-[103.73px] md:right-auto md:bottom-auto md:left-[69.9%] md:h-[560px] md:w-[520px]"
      />

      <Container className="relative lg:pb-[22px]">
        <MobileComposition />
        <DesktopComposition />

        <div
          data-reveal="fade"
          className="flex flex-col items-center gap-4 border-border-soft border-t pt-5 text-center md:flex-row md:justify-between md:text-left"
        >
          <p className="text-[13px] text-text-secondary leading-5">
            © 2026 Matr Studio. All rights reserved.
          </p>
          <div className="flex items-center justify-center gap-6 md:justify-end md:gap-8">
            <nav aria-label="Legal" className="flex items-center gap-1">
              <FooterLink href="#">Privacy</FooterLink>
              <Dot />
              <FooterLink href="#">Terms</FooterLink>
              <Dot />
              <FooterLink href="#">
                Docs
                <img
                  decoding="async"
                  alt=""
                  src={asset("icon-chevron-right.svg")}
                  className="block size-5"
                />
              </FooterLink>
              <img
                decoding="async"
                alt=""
                src={asset("icon-external-link.svg")}
                className="block size-3.5"
              />
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </Container>
    </footer>
  );
}
