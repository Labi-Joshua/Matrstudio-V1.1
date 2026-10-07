import { JoinDialogTrigger } from "./join-dialog";
import { Container, ThemedImg } from "./primitives";

/**
 * Figma: Waitlist / Hero / navbar (62:544). Sits 32px from the top as in the design, then
 * sticks 16px from the top while the page scrolls.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-4 z-40 mt-8 px-4">
      <Container>
        <nav className="flex items-center justify-between rounded-full border border-border-soft bg-bg-fill1/90 py-2.5 pr-2.5 pl-5 backdrop-blur-[8px]">
          <a
            href="/"
            aria-label="Matr Studio home"
            className="shrink-0 transition-transform duration-500 ease-smooth hover:-rotate-3 hover:scale-105"
          >
            <ThemedImg name="logo-nav.svg" alt="matrstudio." width={94.909} height={15} />
          </a>
          <div className="flex items-center justify-end gap-3">
            <a
              href="#mission"
              className="relative after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-500 hover:after:scale-x-100 hidden font-medium text-sm text-text leading-5 tracking-[-0.14px] sm:block"
            >
              Our Mission
            </a>
            <JoinDialogTrigger
              source="waitlist-nav"
              className="rounded-full bg-ink px-3.5 py-2.5 font-medium text-sm text-white leading-5 tracking-[-0.14px] transition-all duration-500 ease-smooth hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-8px_rgba(9,10,11,0.6)] active:translate-y-0 active:scale-[0.97] dark:bg-primary dark:hover:shadow-[0_8px_20px_-8px_rgba(214,92,31,0.7)]"
            >
              Join the Waitlist
            </JoinDialogTrigger>
          </div>
        </nav>
      </Container>
    </header>
  );
}
