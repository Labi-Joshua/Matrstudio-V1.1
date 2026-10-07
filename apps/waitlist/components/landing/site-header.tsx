import { asset, Container } from "./primitives";

/**
 * Figma: Waitlist / Hero / navbar (62:544). Sits 32px from the top as in the design, then
 * sticks 16px from the top while the page scrolls.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-4 z-40 mt-8 px-4">
      <Container>
        <nav className="flex items-center justify-between rounded-full border border-border-soft bg-[#f7f7f8]/90 py-2.5 pr-2.5 pl-5 backdrop-blur-[8px]">
          <a href="/" aria-label="Matr Studio home" className="shrink-0">
            <img alt="matrstudio." src={asset("logo-nav.svg")} width={94.909} height={15} />
          </a>
          <div className="flex items-center justify-end gap-3">
            <a
              href="#mission"
              className="hidden font-medium text-sm text-text leading-5 tracking-[-0.14px] hover:text-text-secondary sm:block"
            >
              Our Mission
            </a>
            <a
              href="#join"
              className="rounded-full bg-ink px-3.5 py-2.5 font-medium text-sm text-white leading-5 tracking-[-0.14px] transition-opacity hover:opacity-90"
            >
              Join the Waitlist
            </a>
          </div>
        </nav>
      </Container>
    </header>
  );
}
