import { cn } from "@matr/ui";
import type { ReactNode } from "react";
import { CountUp } from "../count-up";
import { Avatar, asset, Container, Icon, revealDelay, ThemedImg } from "./primitives";

// Figma: Waitlist / Cards metric (62:577).

const SEGMENTS = 32;
const FILLED_SEGMENTS = 27;

function Card({
  tone = "base",
  className,
  children,
}: {
  tone?: "base" | "fill";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "group flex w-full flex-col items-start rounded-lg border border-border-soft p-6 shadow-e1 transition-all duration-500 ease-smooth hover:-translate-y-1 hover:border-primary-border/60 hover:shadow-[0_16px_32px_-16px_rgba(214,92,31,0.35)]",
        tone === "base" ? "bg-bg-base" : "bg-bg-fill1",
        className,
      )}
    >
      {children}
    </div>
  );
}

function CardTitle({
  title,
  icon,
  iconHover,
}: {
  title: string;
  icon: string;
  /** Animation played on the icon while the card is hovered. */
  iconHover: string;
}) {
  return (
    <div className="flex w-full items-center justify-between">
      <h3 className="font-display font-semibold text-base text-text">{title}</h3>
      <Icon name={icon} className={iconHover} />
    </div>
  );
}

function CardBody({ children }: { children: ReactNode }) {
  return (
    <p className="w-full text-sm text-text-secondary leading-[21px] tracking-[-0.14px]">
      {children}
    </p>
  );
}

/** 48px ring: track, inner disc and the progress arc are the three SVGs exported from Figma. */
function ProgressRing({
  arc,
  arcClassName,
  percent,
  labelLeft,
}: {
  arc: string;
  arcClassName: string;
  percent: number;
  labelLeft: string;
}) {
  return (
    <div className="relative size-12 shrink-0" role="img" aria-label={`${percent}% complete`}>
      <div className="absolute top-[4.27px] left-0 size-12">
        <ThemedImg name="ring-track.svg" className="absolute inset-0 block size-full max-w-none" />
      </div>
      <div className="absolute top-[9.27px] left-[5px] size-[38px]">
        <ThemedImg name="ring-inner.svg" className="absolute inset-0 block size-full max-w-none" />
      </div>
      <div className="absolute top-[4.27px] left-0 size-12 transition-transform duration-[1600ms] ease-gentle group-hover:rotate-[360deg]">
        {/* Separate wrapper so the entrance sweep and the hover spin don't fight. */}
        <div data-reveal-child="sweep" className="absolute inset-0" style={revealDelay(350)}>
          <div className={cn("absolute", arcClassName)}>
            <img
              decoding="async"
              loading="lazy"
              alt=""
              src={asset(arc)}
              className="block size-full max-w-none"
            />
          </div>
        </div>
      </div>
      <span
        className="absolute top-[21.27px] whitespace-nowrap text-[11px] text-text leading-normal"
        style={{ left: labelLeft }}
      >
        <CountUp value={percent} suffix="%" delay={700} />
      </span>
    </div>
  );
}

function StatRow({
  value,
  total,
  caption,
  ring,
}: {
  value: number;
  total: string;
  caption: string;
  ring: ReactNode;
}) {
  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex flex-col items-start gap-0.5 whitespace-nowrap">
        <div className="flex items-baseline gap-1">
          <span className="font-display font-bold text-text text-xl transition-colors duration-500 ease-smooth group-hover:text-primary-text">
            <CountUp value={value} delay={450} />
          </span>
          <span className="text-text-secondary text-xs leading-4 tracking-[-0.12px]">{total}</span>
        </div>
        <span className="text-text-secondary text-xs leading-4 tracking-[-0.12px]">{caption}</span>
      </div>
      {ring}
    </div>
  );
}

function ProfileStack() {
  return (
    <div className="group relative h-[222px] w-[360px] max-w-full">
      <div
        data-reveal-child
        style={revealDelay(450)}
        className="absolute top-[4.27px] left-[40px] h-8 w-[280px] rounded-2xl bg-primary transition-transform duration-700 ease-smooth group-hover:-translate-y-3 group-hover:-rotate-3"
      />
      <div
        data-reveal-child
        style={revealDelay(350)}
        className="absolute top-[16.27px] left-[28px] h-8 w-[304px] rounded-2xl bg-bg-fill2 transition-transform duration-700 ease-smooth group-hover:-translate-y-1.5 group-hover:rotate-2"
      />
      <div className="absolute top-[32.27px] left-[22px] flex h-[190px] w-[316px] flex-col items-start gap-3 overflow-clip rounded-2xl border border-border-alpha bg-bg-base p-5 shadow-card transition-all duration-700 ease-smooth group-hover:translate-y-1 group-hover:shadow-[0_20px_40px_-16px_rgba(25,24,27,0.25)]">
        <div className="flex items-center gap-3">
          <Avatar
            src={asset("avatar-arthur.webp")}
            className="size-9 shrink-0 ring-0 ring-primary transition-all duration-500 group-hover:scale-110 group-hover:ring-2"
          />
          <div className="flex flex-col items-start gap-0.5 whitespace-nowrap leading-normal">
            <span className="font-display font-semibold text-base text-text">Arthur Taylor</span>
            <span className="text-[13px] text-text-secondary">Community Contributor</span>
          </div>
        </div>
        <div className="h-px w-full bg-border-soft" />
        <p className="w-full text-sm text-text-secondary leading-[21px] tracking-[-0.14px]">
          Track your active resource submissions, peer reviews, and completed learning modules.
        </p>
        <div className="flex w-full items-center justify-between whitespace-nowrap text-xs leading-normal">
          <span className="text-text-secondary">Profile details</span>
          <span className="font-display font-semibold text-primary transition-transform duration-500 group-hover:translate-x-1">
            View activity
          </span>
        </div>
      </div>
    </div>
  );
}

function ContributionScore() {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="whitespace-nowrap text-sm text-text-secondary leading-normal">
        Your <span className="text-text">Contribution Score</span> is{" "}
        <CountUp value={710} duration={2400} delay={500} />
      </p>
      <p className="text-center text-text-secondary text-xs leading-4 tracking-[-0.12px]">
        You are in the top 5% of active community reviewers.
      </p>
      <div
        className="group/score relative h-7 w-[316px] max-w-full overflow-clip"
        role="img"
        aria-label={`Contribution score: ${FILLED_SEGMENTS} of ${SEGMENTS} segments`}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed, never reordered
            key={i}
            className="absolute top-[4.55px] h-5 w-[7px] group-hover/score:animate-wave"
            style={{ left: `${7 + i * 9.5}px`, animationDelay: `${i * 40}ms` }}
          >
            <span
              data-reveal-child="grow"
              className={cn(
                "block size-full rounded-[2px]",
                i < FILLED_SEGMENTS ? "bg-primary" : "bg-bg-fill2",
              )}
              style={revealDelay(400 + i * 30)}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section data-reveal="section" id="mission" className="px-4 py-8">
      <Container className="flex flex-col items-center justify-center gap-10 rounded-3xl py-12 lg:h-[550px] lg:flex-row">
        <div data-reveal="left" className="flex w-full max-w-[280px] flex-col items-start gap-4">
          <Card className="gap-4">
            <CardTitle
              title="Structured Learning Paths"
              icon="icon-graduation-cap.svg"
              iconHover="group-hover:animate-wiggle"
            />
            <CardBody>
              Master UI/UX and product design through self-paced courses built to elevate your
              technical execution and visual craft.
            </CardBody>
            <StatRow
              value={12}
              total="/32"
              caption="Modules completed"
              ring={
                <ProgressRing
                  arc="ring-progress-24.svg"
                  arcClassName="top-0 right-0 bottom-[52.49%] left-1/2"
                  percent={24}
                  labelLeft="13px"
                />
              }
            />
          </Card>
          <Card tone="fill" className="gap-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center overflow-hidden rounded-lg bg-primary-accent">
                <Icon name="icon-rocket.svg" className="group-hover:animate-launch" />
              </div>
              <span className="whitespace-nowrap font-bold font-display text-[32px] text-text">
                <CountUp value={96} suffix="%" delay={450} />
              </span>
            </div>
            <CardBody>
              We filter out the fluff so you only interact with quality design resources.
            </CardBody>
          </Card>
        </div>

        <div
          data-reveal
          className="flex w-full max-w-[360px] flex-col items-center gap-6"
          style={revealDelay(120)}
        >
          <ProfileStack />
          <ContributionScore />
        </div>

        <div
          data-reveal="right"
          className="flex w-full max-w-[280px] flex-col items-start gap-4"
          style={revealDelay(240)}
        >
          <Card tone="fill">
            <CardBody>
              Curated design assets, system components, and workflow primitives meticulously indexed
              by the community.
            </CardBody>
          </Card>
          <Card className="gap-3">
            <CardTitle
              title="Open Contributions"
              icon="icon-hand-heart.svg"
              iconHover="group-hover:animate-beat"
            />
            <CardBody>
              Help shape the ecosystem. Contribute high-signal resources, design systems, and
              typography pairings to our centralized directory.
            </CardBody>
            <StatRow
              value={25}
              total="/32"
              caption="Submissions approved"
              ring={
                <ProgressRing
                  arc="ring-progress-64.svg"
                  arcClassName="inset-[0_0_0_11.47%]"
                  percent={64}
                  labelLeft="12.5px"
                />
              }
            />
          </Card>
        </div>
      </Container>
    </section>
  );
}
