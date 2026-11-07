import {
  HELP_CONTACT,
  HELP_EMAIL,
  HELP_EMAIL_LINE,
  HELP_HERO,
  HELP_REPORT,
} from "../../../lib/pages/company-help";
import { HELP_TILES } from "../../../lib/pages/company-tiles";
import { ContactForm, ReportForm } from "./help-forms";
import { TileStrip } from "./tile-strip";

/**
 * Figma "Marketing pages (V3)": Help centre 778:8561 (desktop light 778:8562, mobile light 778:8924,
 * desktop dark 780:26435, mobile dark 780:26826). Hero with tile strip, then two form sections and
 * the email line. On mobile the form card chrome is dropped and the content is left aligned.
 */
const RAIL =
  "mx-auto flex max-w-[1240px] flex-col gap-6 border-border-soft border-r border-l px-4 py-12 md:items-center md:gap-10 md:px-10 md:py-24";
const H2 =
  "font-medium text-[28px] text-text leading-[34px] tracking-[-0.56px] md:text-[36px] md:leading-[42px] md:tracking-[-0.72px] xl:text-[44px] xl:leading-[50px] xl:tracking-[-0.88px]";
const LEAD =
  "text-[16px] text-text-secondary leading-6 tracking-[-0.16px] md:text-[18px] md:leading-7 md:tracking-[-0.18px]";

export function HelpHero() {
  return (
    <section
      aria-labelledby="help-hero-heading"
      className="relative overflow-clip [--t:clamp(36px,calc(100vw/24),80px)]"
    >
      <div className="px-5 lg:px-8">
        <div className="mx-auto flex max-w-[1240px] flex-col items-center gap-4 border-border-soft border-r border-l px-4 pt-14 pb-[calc(2*var(--t)+48px)] text-center md:gap-6 md:px-10 md:pt-[112px] md:pb-[calc(2*var(--t)+96px)]">
          <p className="font-mono text-[11px] text-primary uppercase leading-[normal] tracking-[0.66px] md:text-[13px] md:tracking-[0.78px]">
            {HELP_HERO.eyebrow}
          </p>
          <h1
            id="help-hero-heading"
            className="max-w-[1000px] font-medium text-[40px] text-text leading-[46px] tracking-[-1px] md:text-[56px] md:leading-[62px] md:tracking-[-1.4px] xl:text-[72px] xl:leading-[78px] xl:tracking-[-1.8px]"
          >
            {HELP_HERO.title}
          </h1>
          <p className={`max-w-[680px] ${LEAD}`}>{HELP_HERO.body}</p>
        </div>
      </div>
      <TileStrip tiles={HELP_TILES} className="absolute inset-x-0 bottom-0" />
    </section>
  );
}

function Heading({ id, title, body }: { id: string; title: string; body: string }) {
  return (
    <div className="flex w-full flex-col gap-2 md:items-center md:text-center">
      <h2 id={id} className={H2}>
        {title}
      </h2>
      <p className={LEAD}>{body}</p>
    </div>
  );
}

export function HelpContact() {
  return (
    <section
      id="contact"
      aria-labelledby="help-contact-heading"
      className="border-border-soft border-t px-5 lg:px-8"
    >
      <div className={RAIL}>
        <Heading id="help-contact-heading" title={HELP_CONTACT.title} body={HELP_CONTACT.body} />
        <ContactForm />
      </div>
    </section>
  );
}

export function HelpReport() {
  return (
    <section
      id="report"
      aria-labelledby="help-report-heading"
      className="border-border-soft border-t px-5 lg:px-8"
    >
      <div className={RAIL}>
        <Heading id="help-report-heading" title={HELP_REPORT.title} body={HELP_REPORT.body} />
        <ReportForm />
      </div>
    </section>
  );
}

export function HelpEmail() {
  return (
    <section aria-label="Email" className="border-border-soft border-t px-5 lg:px-8">
      <div className="mx-auto max-w-[1240px] border-border-soft border-r border-l px-4 py-12 md:px-10 md:py-24">
        <p className={`text-left md:text-center ${LEAD}`}>
          {HELP_EMAIL_LINE}{" "}
          <a
            href={`mailto:${HELP_EMAIL}`}
            className="link-slide text-text underline underline-offset-4"
          >
            {HELP_EMAIL}
          </a>
        </p>
      </div>
    </section>
  );
}
