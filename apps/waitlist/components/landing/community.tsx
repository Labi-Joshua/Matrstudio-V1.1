import { cn } from "@matr/ui";
import type { CSSProperties } from "react";
import { WaitlistForm } from "../waitlist-form";
import { Avatar, asset, Container, canvas, Icon, revealDelay, ThemedImg } from "./primitives";

// Figma: Waitlist / Hero (62:739), arc-section frame is 1240 x 460.
const arc = canvas(1240, 460);

/**
 * Pills are sized in em, and the arc sets font-size from its own width (see Community), so they
 * scale with the arc like the rest of the composition: 14px text at the 1240px design size,
 * never below 7px on phones. Figma px → em at 14px: 20px icon = 1.43em, 10px = 0.71em,
 * 8px = 0.57em, 6px = 0.43em, 4px = 0.29em.
 */
function Pill({
  icon,
  label,
  size = "md",
  tone = "neutral",
  at,
  mobileAt,
  delay,
}: {
  icon: string;
  label?: string;
  size?: "md" | "sm";
  tone?: "neutral" | "success";
  /** Figma position on the 1240 x 460 arc. */
  at: [number, number];
  /** Optional position below md, where pills hit their minimum size and need more room. */
  mobileAt?: [number, number];
  delay: number;
}) {
  const desktop = arc(...at);
  const mobile = mobileAt ? arc(...mobileAt) : desktop;
  return (
    <div
      className={cn(
        "group absolute top-[var(--t)] left-[var(--l)] flex items-center whitespace-nowrap rounded-full border border-border-soft transition-all duration-500 ease-smooth hover:z-10 hover:-translate-y-1 hover:scale-105 hover:shadow-e2 max-md:top-[var(--mt)] max-md:left-[var(--ml)]",
        size === "md"
          ? "gap-[0.43em] px-[0.71em] py-[0.43em]"
          : "gap-[0.29em] px-[0.57em] py-[0.29em]",
        // Figma: white in light (62:739); bg/fill1 in dark (66:378).
        tone === "success" ? "bg-success-accent" : "bg-white dark:bg-bg-fill1",
      )}
      data-reveal-child="pop"
      style={
        {
          "--l": desktop.left,
          "--t": desktop.top,
          "--ml": mobile.left,
          "--mt": mobile.top,
          ...revealDelay(delay),
        } as CSSProperties
      }
    >
      <Icon name={icon} className="size-[1.43em] group-hover:animate-wiggle" />
      {label && (
        <span
          className={cn(
            "font-display font-medium text-[1em] leading-normal",
            tone === "success" ? "text-success" : "text-text-secondary",
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}

function ArcAvatar({
  src,
  x,
  y,
  size,
  delay,
}: {
  src: string;
  x: number;
  y: number;
  size: number;
  delay: number;
}) {
  return (
    <Avatar
      src={asset(src)}
      className="absolute aspect-square ring-primary transition-all duration-500 ease-smooth hover:z-10 hover:scale-125 hover:ring-2"
      reveal="pop"
      style={{ ...arc(x, y), width: `${(size / 1240) * 100}%`, ...revealDelay(delay) }}
    />
  );
}

const TOPICS = [
  { icon: "icon-graduation-cap.svg", label: "Learning Paths" },
  { icon: "icon-messages-square.svg", label: "Chat Rooms" },
  { icon: "icon-hand-heart.svg", label: "Contributions" },
];

export function Community() {
  return (
    <section className="px-4 py-8">
      <Container className="flex flex-col items-center pt-[33.55px] pb-[49.45px]">
        {/* The wrapper is a size container so the arc can set its font-size from its width
            (1.129cqw = 14px at 1240px), which is what the em-sized pills scale from. */}
        <div className="w-full [container-type:inline-size]">
          <div
            aria-hidden
            data-reveal="fade"
            className="relative aspect-[1240/460] w-full text-[length:clamp(7px,1.129cqw,14px)]"
          >
            <div data-reveal-child="fade" className="absolute" style={arc(140, 141.545, 960, 318)}>
              <div className="absolute inset-[-0.31%_-0.1%]">
                <ThemedImg name="orbit-inner.svg" className="block size-full max-w-none" />
              </div>
            </div>
            <div data-reveal-child="fade" className="absolute" style={arc(30, 29.545, 1180, 430)}>
              <div className="absolute inset-[-0.23%_0]">
                <ThemedImg name="orbit-outer.svg" className="block size-full max-w-none" />
              </div>
            </div>

            <Pill
              icon="icon-circle-check.svg"
              label="Voting Completed"
              tone="success"
              at={[150, 157.273]}
              delay={250}
            />
            <Pill
              icon="icon-message-circle.svg"
              label="12 New Posts"
              at={[550, 17.545]}
              delay={330}
            />
            <Pill icon="icon-heart.svg" label="12" at={[845, 57.273]} delay={410} />
            {/* Phones: nudged right and down so it clears "Voting Completed" at minimum size. */}
            <Pill
              icon="icon-thumbs-up.svg"
              label="12"
              size="sm"
              at={[388, 169.545]}
              mobileAt={[480, 186]}
              delay={490}
            />
            <Pill icon="icon-files.svg" size="sm" at={[809, 161.273]} delay={570} />
            <Pill icon="icon-shopping-cart.svg" size="sm" at={[368, 51.545]} delay={650} />
            <Pill icon="icon-layers.svg" label="12" size="sm" at={[1090, 287.545]} delay={730} />

            <ArcAvatar src="arc-avatar-left.jpg" x={228} y={255.545} size={60} delay={350} />
            <ArcAvatar src="arc-avatar-center.jpg" x={596} y={117.545} size={48} delay={500} />
            <ArcAvatar src="gallery-avatar-3.jpg" x={978} y={136.545} size={60} delay={650} />

            <div
              className="absolute transition-transform duration-500 ease-smooth hover:scale-150"
              style={arc(985, 282.273, 36, 36)}
            >
              <ThemedImg
                name="arc-center-dot.svg"
                className="absolute inset-0 block size-full max-w-none"
              />
            </div>
          </div>
        </div>

        {/* Phones: the arc runs to its bottom edge, so give the form some breathing room. */}
        <div data-reveal className="mt-10 flex w-full flex-col items-center gap-9 md:mt-0">
          <WaitlistForm variant="primary" source="waitlist-community" className="items-center" />
          <h2 className="text-center font-display font-medium text-[28px] text-text leading-9 tracking-[-0.56px] md:text-[32px] md:leading-10 md:tracking-[-0.64px]">
            A Collaborative Hub for the <br className="hidden md:inline" />
            Design Ecosystem
          </h2>
          <ul className="flex flex-wrap items-center justify-center gap-3 md:gap-5">
            {TOPICS.map(({ icon, label }) => (
              <li
                key={label}
                className="group flex items-center gap-2 rounded-full border border-border px-3 py-2 transition-all md:px-4 md:py-2.5 duration-500 ease-smooth hover:-translate-y-0.5 hover:border-primary-border hover:bg-primary-accent"
              >
                <Icon name={icon} className="group-hover:animate-wiggle" />
                <span className="whitespace-nowrap font-display font-medium text-sm text-text-secondary md:text-base transition-colors duration-500 ease-smooth group-hover:text-primary-text">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
