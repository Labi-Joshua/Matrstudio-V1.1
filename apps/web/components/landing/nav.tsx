// Figma "Product landing page · V3": Nav 742:42243 (desktop) and 742:42425 (mobile, only the CTA).
import Link from "next/link";
import { ROUTES } from "../../lib/routes";
import { NavState } from "./nav-state";

const LINKS = [
  { label: "Paths", href: ROUTES.paths },
  { label: "Library", href: ROUTES.library },
  { label: "Our mission", href: ROUTES.mission },
];

export function Nav() {
  return (
    <header
      data-nav=""
      className="sticky top-0 z-50 border-border-soft border-b bg-bg-base/70 px-5 py-4 backdrop-blur-xl transition-[padding] duration-300 data-[stuck]:py-3 lg:px-8 lg:pt-8 lg:pb-6 lg:data-[stuck]:py-3"
    >
      <NavState />
      <nav
        aria-label="Main"
        className="mx-auto flex w-full max-w-[1240px] items-center justify-between rounded-full border border-border-soft bg-bg-fill1/70 py-1.5 pr-1.5 pl-4 backdrop-blur-[8px] lg:py-2.5 lg:pr-2.5 lg:pl-5"
      >
        <Link href={ROUTES.home} aria-label="Matr Studio home" className="flex items-center">
          <img
            src="/images/logo-nav.svg"
            alt=""
            width={95}
            height={15}
            className="block dark:hidden"
          />
          <img
            src="/images/logo-nav-dark.svg"
            alt=""
            width={95}
            height={15}
            className="hidden dark:block"
          />
        </Link>
        <div className="flex items-center gap-3 lg:gap-7">
          <ul className="hidden items-center gap-7 lg:flex">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px] hover:text-primary-text"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={ROUTES.signIn}
                className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px] hover:text-primary-text"
              >
                Sign in
              </Link>
            </li>
          </ul>
          <Link
            href={ROUTES.signUp}
            className="btn-lift rounded-full bg-ink px-3 py-2.5 font-medium text-[14px] text-bg-base leading-5 tracking-[-0.14px]"
          >
            <span className="px-0.5">Get started</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
