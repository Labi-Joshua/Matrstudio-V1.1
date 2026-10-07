import { cn } from "@matr/ui";
import type { CSSProperties } from "react";
import { WaitlistForm } from "../waitlist-form";
import { Avatar, asset, Container, canvas, Icon } from "./primitives";

// Figma: Waitlist / Hero (62:739), arc-section frame is 1240 x 460.
const arc = canvas(1240, 460);

function Pill({
  icon,
  label,
  size = "md",
  tone = "neutral",
  style,
}: {
  icon: string;
  label?: string;
  size?: "md" | "sm";
  tone?: "neutral" | "success";
  style: CSSProperties;
}) {
  return (
    <div
      className={cn(
        "absolute hidden items-center whitespace-nowrap rounded-full border border-border-soft md:flex",
        size === "md" ? "gap-1.5 px-2.5 py-1.5" : "gap-1 px-2 py-1",
        tone === "success" ? "bg-success-accent" : "bg-white",
      )}
      style={style}
    >
      <Icon name={icon} />
      {label && (
        <span
          className={cn(
            "font-display font-medium text-sm leading-normal",
            tone === "success" ? "text-success" : "text-text-secondary",
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}

function ArcAvatar({ src, x, y, size }: { src: string; x: number; y: number; size: number }) {
  return (
    <Avatar
      src={asset(src)}
      className="absolute aspect-square"
      style={{ ...arc(x, y), width: `${(size / 1240) * 100}%` }}
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
        <div aria-hidden className="relative aspect-[1240/460] w-full">
          <div className="absolute" style={arc(140, 141.545, 960, 318)}>
            <div className="absolute inset-[-0.31%_-0.1%]">
              <img alt="" src={asset("orbit-inner.svg")} className="block size-full max-w-none" />
            </div>
          </div>
          <div className="absolute" style={arc(30, 29.545, 1180, 430)}>
            <div className="absolute inset-[-0.23%_0]">
              <img alt="" src={asset("orbit-outer.svg")} className="block size-full max-w-none" />
            </div>
          </div>

          <Pill
            icon="icon-circle-check.svg"
            label="Voting Completed"
            tone="success"
            style={arc(150, 157.273)}
          />
          <Pill icon="icon-message-circle.svg" label="12 New Posts" style={arc(550, 17.545)} />
          <Pill icon="icon-heart.svg" label="12" style={arc(845, 57.273)} />
          <Pill icon="icon-thumbs-up.svg" label="12" size="sm" style={arc(388, 169.545)} />
          <Pill icon="icon-files.svg" size="sm" style={arc(809, 161.273)} />
          <Pill icon="icon-shopping-cart.svg" size="sm" style={arc(368, 51.545)} />
          <Pill icon="icon-layers.svg" label="12" size="sm" style={arc(1090, 287.545)} />

          <ArcAvatar src="arc-avatar-left.jpg" x={228} y={255.545} size={60} />
          <ArcAvatar src="arc-avatar-center.jpg" x={596} y={117.545} size={48} />
          <ArcAvatar src="gallery-avatar-3.jpg" x={978} y={136.545} size={60} />

          <div className="absolute" style={arc(985, 282.273, 36, 36)}>
            <img
              alt=""
              src={asset("arc-center-dot.svg")}
              className="absolute inset-0 block size-full max-w-none"
            />
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-9">
          <WaitlistForm variant="primary" source="waitlist-community" className="items-center" />
          <h2 className="text-center font-display font-medium text-[32px] text-text leading-10 tracking-[-0.64px]">
            A Collaborative Hub for the
            <br />
            Design Ecosystem
          </h2>
          <ul className="flex flex-wrap items-center justify-center gap-5">
            {TOPICS.map(({ icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-2 rounded-full border border-border px-4 py-2.5"
              >
                <Icon name={icon} />
                <span className="whitespace-nowrap font-display font-medium text-base text-text-secondary">
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
