import { cn } from "@matr/ui";
import { Fragment } from "react";
import { type Inline, LEGAL_DOCS, type LegalDoc } from "../../content/legal";
import { asset, Container, ThemedImg } from "../landing/primitives";
import { SiteFooter } from "../landing/site-footer";
import { LogoHeader } from "../landing/site-header";
import { RevealObserver } from "../reveal-observer";
import { LegalToc } from "./toc";

// Figma: MatrStudio V 1.1 / Legal (194:2): Privacy Policy (194:422, dark 194:3619) and Terms of
// Service (195:421, dark 195:3755). Logo-only navbar, header, document tabs, a sticky
// "On this page" list beside the numbered sections, and the site footer.

function Text({ parts }: { parts: Inline[] }) {
  return parts.map((part, i) => {
    // biome-ignore lint/suspicious/noArrayIndexKey: static copy, order never changes
    if (typeof part === "string") return <Fragment key={i}>{part}</Fragment>;
    if ("b" in part) {
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: static copy, order never changes
        <span key={i} className="font-medium text-text">
          {part.b}
        </span>
      );
    }
    // A detail still to be filled in, highlighted as in the design.
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: static copy, order never changes
      <mark key={i} className="bg-transparent text-primary">
        {part.todo}
      </mark>
    );
  });
}

const body = "text-base text-text-secondary leading-6 tracking-[-0.16px]";

export function LegalPage({ doc }: { doc: LegalDoc }) {
  const toc = [
    ...doc.sections.map((s, i) => ({ id: s.id, label: `${i + 1}. ${s.title}` })),
    { id: doc.contact.id, label: `${doc.sections.length + 1}. Contact us` },
  ];

  return (
    <>
      <LogoHeader />
      <main className="px-4 pt-14 pb-16">
        <Container className="flex max-w-[1120px] flex-col gap-12">
          {/* Header */}
          <header data-reveal-load className="flex flex-col items-start gap-4">
            <span className="rounded-md bg-primary-focus px-2 py-[3px] font-display font-medium text-[13px] text-primary-text leading-[18px] tracking-[-0.13px]">
              Legal
            </span>
            <h1 className="font-display font-medium text-[36px] text-text leading-[44px] tracking-[-0.36px] sm:text-[48px] sm:leading-[60px] sm:tracking-[-0.48px]">
              {doc.title}
            </h1>
            <p className="max-w-[760px] text-lg text-text-secondary leading-7 tracking-[-0.18px]">
              {doc.intro}
            </p>
            <p className="text-sm text-text-secondary leading-5 tracking-[-0.14px]">
              Last updated {doc.updated}
              <span aria-hidden className="px-2">
                ·
              </span>
              Effective {doc.effective}
            </p>
          </header>

          {/* Document tabs */}
          <nav
            aria-label="Legal documents"
            data-reveal-load="fade"
            className="flex border-border-soft-alpha border-b"
          >
            {LEGAL_DOCS.map((d) => (
              <a
                key={d.slug}
                href={`/${d.slug}`}
                aria-current={d.slug === doc.slug ? "page" : undefined}
                className={cn(
                  "-mb-px border-b-2 px-1.5 py-2.5 font-display font-medium text-sm leading-5 tracking-[-0.14px] transition-colors duration-300 ease-smooth",
                  d.slug === doc.slug
                    ? "border-primary text-text"
                    : "border-transparent text-text-secondary hover:text-text",
                )}
              >
                {d.tab}
              </a>
            ))}
          </nav>

          <div className="flex items-start gap-20">
            {/* Sticky table of contents, from lg up. */}
            <aside className="sticky top-24 hidden w-[280px] shrink-0 lg:block">
              <LegalToc items={toc} />
            </aside>

            <article className="flex min-w-0 max-w-[760px] flex-1 flex-col gap-10">
              <section
                data-reveal
                aria-label="Summary"
                className="flex flex-col gap-3 rounded-xl border border-primary-border bg-primary-accent p-6 text-base text-text leading-6 tracking-[-0.16px]"
              >
                <h2 className="font-semibold">The short version</h2>
                <ul className="list-disc space-y-0 pl-6">
                  {doc.summary.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </section>

              {doc.sections.map((section, i) => (
                <section
                  key={section.id}
                  id={section.id}
                  data-reveal
                  className="flex scroll-mt-28 flex-col gap-3"
                >
                  <h2 className="font-display font-medium text-text text-xl leading-7 tracking-[-0.2px]">
                    {i + 1}. {section.title}
                  </h2>
                  {section.blocks.map((block, j) =>
                    "p" in block ? (
                      // biome-ignore lint/suspicious/noArrayIndexKey: static copy, order never changes
                      <p key={j} className={body}>
                        <Text parts={block.p} />
                      </p>
                    ) : (
                      // biome-ignore lint/suspicious/noArrayIndexKey: static copy, order never changes
                      <ul key={j} className={cn(body, "list-disc pl-6")}>
                        {block.ul.map((item, k) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: static copy, order never changes
                          <li key={k}>
                            <Text parts={item} />
                          </li>
                        ))}
                      </ul>
                    ),
                  )}
                </section>
              ))}

              {/* Contact card */}
              <section
                id={doc.contact.id}
                data-reveal
                className="flex scroll-mt-28 flex-col items-start gap-4 rounded-2xl border border-border-soft bg-bg-fill1 p-6 sm:flex-row sm:items-center"
              >
                <span className="flex shrink-0 rounded-xl border border-primary-border bg-primary-accent p-3">
                  <img
                    alt=""
                    src={asset("legal-mail-tile.svg")}
                    width={24}
                    height={24}
                    className="size-6"
                  />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h2 className="font-semibold text-base text-text leading-6 tracking-[-0.16px]">
                    {doc.sections.length + 1}. {doc.contact.title}
                  </h2>
                  <p className="text-sm text-text-secondary leading-5 tracking-[-0.14px]">
                    {doc.contact.text}
                  </p>
                </div>
                <a
                  href={`mailto:${doc.contact.email}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-bg-elevation-1 px-3.5 py-2.5 font-medium text-sm text-text leading-5 tracking-[-0.14px] shadow-e1 transition-colors duration-300 ease-smooth hover:border-text-secondary/40"
                >
                  <ThemedImg name="legal-mail.svg" width={20} height={20} className="size-5" />
                  Email us
                </a>
              </section>
            </article>
          </div>
        </Container>
      </main>
      <SiteFooter />
      <RevealObserver />
    </>
  );
}
