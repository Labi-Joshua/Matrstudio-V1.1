import Link from "next/link";
import { ROUTES } from "../../lib/routes";
import { FooterPattern } from "./footer-pattern";
import { FooterThemeSwitch } from "./footer-theme-switch";

// Placeholder target for links whose page does not exist yet (the social profiles).
const TODO_HREF = "#";

/**
 * Figma "Product landing page · V3": Footer 742:42628 (desktop, dark) and 742:42804 (mobile).
 * Columns stack below md. Only the social icons still point at "#" (no profiles yet).
 */
const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Learn",
    links: [
      { label: "Paths", href: ROUTES.paths },
      { label: "Library", href: ROUTES.library },
      { label: "Saved", href: ROUTES.saved },
      { label: "Submit a resource", href: ROUTES.submit },
    ],
  },
  {
    title: "Topics",
    links: [
      { label: "UI/UX", href: ROUTES.topic("ui-ux") },
      { label: "Brand", href: ROUTES.topic("brand") },
      { label: "Product", href: ROUTES.topic("product") },
      { label: "SEO", href: ROUTES.topic("seo") },
      { label: "Social media design", href: ROUTES.topic("social-media") },
      { label: "Design systems", href: ROUTES.topic("design-systems") },
      { label: "Dev handoff", href: ROUTES.topic("dev-handoff") },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Our mission", href: ROUTES.mission },
      { label: "Help centre", href: ROUTES.help },
      { label: "Terms of Service", href: ROUTES.terms },
      { label: "Privacy Policy", href: ROUTES.privacy },
    ],
  },
];

const SOCIALS = [
  { label: "LinkedIn", icon: "linkedin" },
  { label: "X", icon: "x" },
  { label: "YouTube", icon: "youtube" },
  { label: "Instagram", icon: "instagram" },
  { label: "Discord", icon: "discord" },
];

/** Monochrome artwork drawn as a mask, so it takes the theme's text colour. */
function Mask({ src, className }: { src: string; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block ${className}`}
      style={{
        maskImage: `url(${src})`,
        maskRepeat: "no-repeat",
        maskSize: "100% 100%",
        WebkitMaskImage: `url(${src})`,
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskSize: "100% 100%",
      }}
    />
  );
}

export function Footer() {
  return (
    <footer className="border-border-soft border-t">
      <div className="border-border-soft border-b px-5 lg:px-8">
        <nav
          aria-label="Footer"
          className="mx-auto flex w-full max-w-[1240px] flex-col border-border-soft border-r border-l md:flex-row"
        >
          {COLUMNS.map((column) => (
            <div
              key={column.title}
              className="flex flex-col gap-2.5 border-border-soft border-b px-4 py-7 last:border-b-0 md:flex-1 md:gap-3.5 md:border-r md:border-b-0 md:px-8 md:py-10 md:last:border-r-0"
            >
              <h2 className="font-medium text-[14px] text-text-tertiary leading-5 tracking-[-0.14px]">
                {column.title}
              </h2>
              <ul className="flex flex-col gap-2.5 md:gap-3.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="font-medium text-[16px] text-text leading-6 tracking-[-0.16px] hover:text-primary-text"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="px-5 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-2.5 py-7 md:flex-row md:items-center md:justify-between md:px-8 md:py-11">
          <ul className="flex items-center gap-5 md:gap-7">
            {SOCIALS.map((social) => (
              <li key={social.label}>
                <a
                  href={TODO_HREF}
                  aria-label={social.label}
                  className="block size-[22px] text-text hover:-translate-y-0.5 hover:scale-110 md:size-[26px]"
                >
                  <Mask src={`/images/footer/${social.icon}.svg`} className="size-full bg-text" />
                </a>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
            <p className="text-[14px] text-text-tertiary leading-5 tracking-[-0.14px]">
              Know a great free resource?
            </p>
            <Link
              href={ROUTES.submit}
              className="btn-lift flex items-center justify-center rounded-lg border border-border bg-bg-elevation-1 px-2.5 py-2 font-medium text-[14px] text-text leading-5 tracking-[-0.14px] shadow-e1"
            >
              <span className="px-0.5">Submit a resource</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="overflow-clip">
        <div className="px-5 lg:px-8">
          <div className="mx-auto w-full max-w-[1240px] pt-6 md:pt-8">
            <div className="flex items-start justify-between gap-4">
              <p className="mt-2.5 text-[14px] text-text-tertiary leading-5 tracking-[-0.14px]">
                Matr Studio © 2026
              </p>
              <FooterThemeSwitch />
            </div>
            <div
              aria-hidden="true"
              className="relative mt-[30px] aspect-[1240/196] w-full xl:mt-[54px]"
            >
              <Mask src="/images/footer/wordmark.svg" className="absolute inset-0 bg-text" />
              <Mask src="/images/footer/wordmark-dot.svg" className="absolute inset-0 bg-primary" />
            </div>
          </div>
        </div>
        <div className="mt-6 xl:mt-10">
          <FooterPattern />
        </div>
      </div>
    </footer>
  );
}
