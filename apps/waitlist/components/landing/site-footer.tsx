import { cn } from "@matr/ui";
import type { CSSProperties, ReactNode } from "react";
import { atmosphere } from "./join-cta";
import { asset, Container, canvas } from "./primitives";

// Figma: Waitlist / Footer (62:817). The logo composition is laid out on a 1240 x 478 canvas
// (everything above the utility bar). Badges inside logo-scale-frame are offset by (10, 106.273).
// There is no mobile frame: below lg the badges move into staggered rows around the wordmark.
const comp = canvas(1240, 478);

function BadgeIcon({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="flex size-[23.363px] shrink-0 items-center justify-center rounded-[5.841px]"
      style={{ backgroundColor: color }}
    >
      <img alt="" src={asset(name)} className="block size-[13.628px]" />
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
  /** Mobile placement: which row, plus a small tilt and vertical stagger. */
  mobile: { row: "top" | "bottom"; rotate: number; offsetY: number };
  content: ReactNode;
};

const BADGES: FooterBadge[] = [
  {
    id: "components",
    className: cn(pill, "border-primary-border bg-[#ffe8e0]"),
    at: [300, 109],
    mobile: { row: "top", rotate: -3, offsetY: 6 },
    content: (
      <>
        <BadgeIcon name="icon-component.svg" color="var(--color-primary)" />
        <BadgeText title="Reusable components" />
      </>
    ),
  },
  {
    id: "layers",
    className: cn(pill, "border-[#c7ccfa] bg-[#eef0ff]"),
    at: [637, 112],
    mobile: { row: "top", rotate: 2, offsetY: -4 },
    content: (
      <>
        <BadgeIcon name="icon-layers-white.svg" color="#6e78f7" />
        <BadgeText title="Layers & Theming" subtitle="Dark & light ready" />
      </>
    ),
  },
  {
    id: "design-system",
    className: cn(pill, "border-border bg-bg-fill1"),
    at: [-39, 196],
    mobile: { row: "top", rotate: -1.5, offsetY: 2 },
    content: (
      <>
        <span className="flex size-[19.469px] shrink-0 items-center justify-center rounded-full bg-primary-focus font-display font-semibold text-[11.68px] text-primary">
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
    className: cn(pill, "border-[#7de0b0] bg-[#e8fff4]"),
    at: [188, 280],
    mobile: { row: "bottom", rotate: 2, offsetY: -2 },
    content: (
      <>
        <BadgeIcon name="icon-code.svg" color="#1da54a" />
        <BadgeText title="Dev-ready Exports" subtitle="JSX & Tokens" />
      </>
    ),
  },
  {
    id: "color-tokens",
    className: cn(pill, "border-[#ffd98a] bg-[#fff5e0]"),
    at: [1066, 144],
    mobile: { row: "bottom", rotate: -2.5, offsetY: 5 },
    content: (
      <>
        <BadgeIcon name="icon-palette.svg" color="#f5a623" />
        <BadgeText title="Color Tokens" subtitle="Semantic palette" />
      </>
    ),
  },
  {
    id: "community",
    className: "rounded-[13.628px] border-border bg-bg-base px-[9.735px] py-[7.788px]",
    at: [746, 281],
    mobile: { row: "bottom", rotate: 1, offsetY: 0 },
    content: (
      <>
        <span className="flex items-center">
          {["footer-avatar-1.jpg", "footer-avatar-2.jpg", "footer-avatar-3.jpg"].map((src, i) => (
            <img
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
  "flex items-center gap-[5.841px] whitespace-nowrap border-[0.973px] drop-shadow-badge";

function Wordmark({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <img
      alt="matrstudio."
      src={asset("logo-wordmark.svg")}
      className={cn("block max-w-none", className)}
      style={style}
    />
  );
}

/** Below lg: wordmark framed by two loose rows of badges, slightly enlarged for legibility. */
function MobileComposition() {
  const row = (which: "top" | "bottom") => (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 [zoom:1.15]">
      {BADGES.filter((b) => b.mobile.row === which).map(({ id, className, mobile, content }) => (
        <div
          key={id}
          className={cn(badgeBase, className)}
          style={{ transform: `translateY(${mobile.offsetY}px) rotate(${mobile.rotate}deg)` }}
        >
          {content}
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-7 pt-6 pb-10 lg:hidden">
      {row("top")}
      <Wordmark className="h-auto w-full" />
      {row("bottom")}
    </div>
  );
}

/** lg and up: the Figma composition, scaled with its container. */
function DesktopComposition() {
  return (
    <div className="relative hidden aspect-[1240/478] w-full lg:block">
      <Wordmark className="absolute" style={comp(10, 106.273, 1220, 192.817)} />
      {BADGES.map(({ id, className, at: [x, y], content }) => {
        const style = comp(x, y);
        // Badges that hang outside the 1240 frame (x < 0) must not run off a narrow viewport:
        // (100% - 100vw) / 2 is the viewport edge relative to the centred container.
        if (x < 0) style.left = `max(${style.left}, calc((100% - 100vw) / 2 + 8px))`;
        return (
          <div key={id} className={cn(badgeBase, "absolute", className)} style={style}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="flex items-center gap-1 font-medium text-sm text-text-secondary leading-5 tracking-[-0.14px] hover:text-text"
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
      {/* Glows: Figma sizes from md up; smaller and pulled to the edges on phones. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-[-30%] h-[340px] w-[320px] md:top-[-8.27px] md:left-[8.28%] md:h-[484px] md:w-[449px]"
        style={{ background: atmosphere.cool }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-35%] bottom-0 h-[380px] w-[350px] md:top-[103.73px] md:right-auto md:bottom-auto md:left-[69.9%] md:h-[560px] md:w-[520px]"
        style={{ background: atmosphere.warm }}
      />

      <Container className="relative lg:pb-[22px]">
        <MobileComposition />
        <DesktopComposition />

        <div className="flex flex-col items-center gap-4 border-border-soft border-t pt-5 text-center md:flex-row md:justify-between md:text-left">
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
                <img alt="" src={asset("icon-chevron-right.svg")} className="block size-5" />
              </FooterLink>
              <img alt="" src={asset("icon-external-link.svg")} className="block size-3.5" />
            </nav>
            {/* Static until the dark-mode design is implemented. */}
            <div
              aria-hidden
              className="flex h-9 items-center gap-2 rounded-full border border-border-soft-alpha bg-bg-base p-2"
            >
              <img alt="" src={asset("icon-sun.svg")} className="block size-[18px]" />
              <span className="relative h-4 w-8">
                <span className="absolute inset-[-6.25%_0_-18.75%_-6.25%]">
                  <img
                    alt=""
                    src={asset("toggle-switch.svg")}
                    className="block size-full max-w-none"
                  />
                </span>
              </span>
              <img alt="" src={asset("icon-moon.svg")} className="block size-[18px]" />
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}
