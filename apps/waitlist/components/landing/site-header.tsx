import { cn } from "@matr/ui";
import { JoinDialogTrigger } from "./join-dialog";
import { MobileMenu } from "./mobile-menu";
import { Container, ThemedImg } from "./primitives";

/**
 * Figma: Waitlist / Hero / navbar (62:544). Sits 32px from the top as in the design, then
 * sticks 16px from the top while the page scrolls. From sm up the page links sit in the centre
 * column; below sm they live in MobileMenu.
 */
const LINKS = [
  { href: "/", label: "Home", page: "home" },
  { href: "/mission", label: "Our Mission", page: "mission" },
] as const;

export function SiteHeader({ current }: { current: "home" | "mission" }) {
  return (
    <header className="sticky top-4 z-40 mt-8 px-4">
      <Container>
        <nav className="relative flex items-center justify-between gap-1.5 sm:grid sm:grid-cols-[1fr_auto_1fr] rounded-full border border-border-soft bg-bg-fill1/90 py-2.5 pr-2 pl-3.5 min-[360px]:pr-2.5 min-[360px]:pl-4 backdrop-blur-[8px] sm:pl-5">
          <a
            href="/"
            aria-label="Matr Studio home"
            className="shrink-0 justify-self-start transition-transform duration-500 ease-smooth hover:-rotate-3 hover:scale-105"
          >
            {/* Slightly smaller below sm so the logo, button and menu fit on one line, down to 320px. */}
            <ThemedImg
              name="logo-nav.svg"
              alt="matrstudio."
              width={94.909}
              height={15}
              className="block h-auto w-[68px] min-[360px]:w-[78px] sm:w-[94.909px]"
            />
          </a>
          <div className="hidden items-center gap-6 sm:flex">
            {LINKS.map(({ href, label, page }) => (
              <a
                key={href}
                href={href}
                aria-current={current === page ? "page" : undefined}
                className={cn(
                  "relative whitespace-nowrap font-medium text-sm leading-5 tracking-[-0.14px] transition-colors duration-500 ease-smooth after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-500 hover:text-text hover:after:scale-x-100",
                  current === page ? "text-text" : "text-text-secondary",
                )}
              >
                {label}
              </a>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 justify-self-end min-[360px]:gap-2.5">
            <JoinDialogTrigger
              source="waitlist-nav"
              className="whitespace-nowrap rounded-full bg-ink px-2.5 py-2.5 font-medium text-[12px] text-white leading-5 tracking-[-0.12px] min-[360px]:px-3 min-[360px]:text-[13px] min-[360px]:tracking-[-0.13px] sm:px-3.5 sm:text-sm sm:tracking-[-0.14px] transition-all duration-500 ease-smooth hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-8px_rgba(9,10,11,0.6)] active:translate-y-0 active:scale-[0.97] dark:bg-primary dark:hover:shadow-[0_8px_20px_-8px_rgba(214,92,31,0.7)]"
            >
              Join the Waitlist
            </JoinDialogTrigger>
            <MobileMenu />
          </div>
        </nav>
      </Container>
    </header>
  );
}
