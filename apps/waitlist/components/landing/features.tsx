import { cn } from "@matr/ui";
import type { ReactNode } from "react";
import { Avatar, asset, Container, Icon } from "./primitives";

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
        "flex w-full flex-col items-start rounded-lg border border-border-soft p-6 drop-shadow-e1",
        tone === "base" ? "bg-bg-base" : "bg-bg-fill1",
        className,
      )}
    >
      {children}
    </div>
  );
}

function CardTitle({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex w-full items-center justify-between">
      <h3 className="font-display font-semibold text-base text-text">{title}</h3>
      <Icon name={icon} />
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
  label,
  labelLeft,
}: {
  arc: string;
  arcClassName: string;
  label: string;
  labelLeft: string;
}) {
  return (
    <div className="relative size-12 shrink-0" role="img" aria-label={`${label} complete`}>
      <div className="absolute top-[4.27px] left-0 size-12">
        <img
          alt=""
          src={asset("ring-track.svg")}
          className="absolute inset-0 block size-full max-w-none"
        />
      </div>
      <div className="absolute top-[9.27px] left-[5px] size-[38px]">
        <img
          alt=""
          src={asset("ring-inner.svg")}
          className="absolute inset-0 block size-full max-w-none"
        />
      </div>
      <div className="absolute top-[4.27px] left-0 size-12">
        <div className={cn("absolute", arcClassName)}>
          <img alt="" src={asset(arc)} className="block size-full max-w-none" />
        </div>
      </div>
      <span
        className="absolute top-[21.27px] whitespace-nowrap text-[11px] text-text leading-normal"
        style={{ left: labelLeft }}
      >
        {label}
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
  value: string;
  total: string;
  caption: string;
  ring: ReactNode;
}) {
  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex flex-col items-start gap-0.5 whitespace-nowrap">
        <div className="flex items-baseline gap-1">
          <span className="font-display font-bold text-text text-xl">{value}</span>
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
    <div className="relative h-[222px] w-[360px] max-w-full">
      <div className="absolute top-[4.27px] left-[40px] h-8 w-[280px] rounded-2xl bg-primary" />
      <div className="absolute top-[16.27px] left-[28px] h-8 w-[304px] rounded-2xl bg-bg-fill2" />
      <div className="absolute top-[32.27px] left-[22px] flex h-[190px] w-[316px] flex-col items-start gap-3 overflow-clip rounded-2xl border border-border-alpha bg-bg-base p-5 shadow-card">
        <div className="flex items-center gap-3">
          <Avatar src={asset("avatar-arthur.jpg")} className="size-9 shrink-0" />
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
          <span className="font-display font-semibold text-primary">View activity</span>
        </div>
      </div>
    </div>
  );
}

function ContributionScore() {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="whitespace-nowrap text-sm text-text-secondary leading-normal">
        Your <span className="text-text">Contribution Score</span> is 710
      </p>
      <p className="text-center text-text-secondary text-xs leading-4 tracking-[-0.12px]">
        You are in the top 5% of active community reviewers.
      </p>
      <div
        className="relative h-7 w-[316px] max-w-full overflow-clip"
        role="img"
        aria-label={`Contribution score: ${FILLED_SEGMENTS} of ${SEGMENTS} segments`}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed, never reordered
            key={i}
            className={cn(
              "absolute top-[4.55px] h-5 w-[7px] rounded-[2px]",
              i < FILLED_SEGMENTS ? "bg-primary" : "bg-bg-fill2",
            )}
            style={{ left: `${7 + i * 9.5}px` }}
          />
        ))}
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section id="mission" className="px-4 py-8">
      <Container className="flex flex-col items-center justify-center gap-10 rounded-3xl py-12 lg:h-[550px] lg:flex-row">
        <div className="flex w-full max-w-[280px] flex-col items-start gap-4">
          <Card className="gap-4">
            <CardTitle title="Structured Learning Paths" icon="icon-graduation-cap.svg" />
            <CardBody>
              Master UI/UX and product design through self-paced courses built to elevate your
              technical execution and visual craft.
            </CardBody>
            <StatRow
              value="12"
              total="/32"
              caption="Modules completed"
              ring={
                <ProgressRing
                  arc="ring-progress-24.svg"
                  arcClassName="top-0 right-0 bottom-[52.49%] left-1/2"
                  label="24%"
                  labelLeft="13px"
                />
              }
            />
          </Card>
          <Card tone="fill" className="gap-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary-accent">
                <Icon name="icon-rocket.svg" />
              </div>
              <span className="whitespace-nowrap font-bold font-display text-[32px] text-text">
                96%
              </span>
            </div>
            <CardBody>
              We filter out the fluff so you only interact with quality design resources.
            </CardBody>
          </Card>
        </div>

        <div className="flex w-full max-w-[360px] flex-col items-center gap-6">
          <ProfileStack />
          <ContributionScore />
        </div>

        <div className="flex w-full max-w-[280px] flex-col items-start gap-4">
          <Card tone="fill">
            <CardBody>
              Curated design assets, system components, and workflow primitives meticulously indexed
              by the community.
            </CardBody>
          </Card>
          <Card className="gap-3">
            <CardTitle title="Open Contributions" icon="icon-hand-heart.svg" />
            <CardBody>
              Help shape the ecosystem. Contribute high-signal resources, design systems, and
              typography pairings to our centralized directory.
            </CardBody>
            <StatRow
              value="25"
              total="/32"
              caption="Submissions approved"
              ring={
                <ProgressRing
                  arc="ring-progress-64.svg"
                  arcClassName="inset-[0_0_0_11.47%]"
                  label="64%"
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
