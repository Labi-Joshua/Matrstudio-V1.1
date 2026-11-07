import { Fragment } from "react";
import type { Tile } from "../../../lib/pages/company-tiles";
import type { Inline, LegalDoc } from "../../../lib/pages/legal-docs";
import { LegalToc } from "./legal-toc";
import { TileStrip } from "./tile-strip";

/**
 * Figma "Marketing pages (V3)": Terms of Service 780:10524 and Privacy Policy 780:11046 (desktop
 * 1920 frames, 430px mobile frames, light and dark). Hero with a tile strip, then a body with the
 * sticky "On this page" card (from lg up; the mobile frames have none) beside the sections.
 */
function Text({ parts }: { parts: Inline[] }) {
  return parts.map((part, i) => {
    // biome-ignore lint/suspicious/noArrayIndexKey: static copy, order never changes
    if (typeof part === "string") return <Fragment key={i}>{part}</Fragment>;
    if ("b" in part) {
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: static copy, order never changes
        <strong key={i} className="font-medium text-text">
          {part.b}
        </strong>
      );
    }
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: static copy, order never changes
      <mark key={i} className="bg-transparent text-primary">
        {part.todo}
      </mark>
    );
  });
}

const BODY = "text-[16px] text-text-secondary leading-6 tracking-[-0.16px]";

function Bullets({ items }: { items: Inline[][] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static copy, order never changes
        <li key={i} className="flex items-start gap-3">
          <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" />
          <span className={`min-w-0 flex-1 ${BODY}`}>
            <Text parts={item} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function LegalPage({ doc, tiles }: { doc: LegalDoc; tiles: readonly Tile[] }) {
  const toc = [
    ...doc.sections.map((s, i) => ({ id: s.id, label: `${i + 1}. ${s.title}` })),
    { id: doc.contact.id, label: `${doc.sections.length + 1}. Contact us` },
  ];

  return (
    <main>
      <section className="relative overflow-clip [--t:clamp(36px,calc(100vw/24),80px)]">
        <div className="px-5 lg:px-8">
          <div className="mx-auto flex max-w-[1240px] flex-col items-start gap-3.5 border-border-soft border-r border-l px-4 pt-14 pb-[calc(2*var(--t)+48px)] md:gap-5 md:px-10 md:pt-[112px] md:pb-[calc(2*var(--t)+96px)]">
            <p className="font-mono text-[11px] text-primary uppercase leading-[normal] tracking-[0.66px] md:text-[13px] md:tracking-[0.78px]">
              Legal
            </p>
            <h1 className="font-medium text-[40px] text-text leading-[46px] tracking-[-1px] md:text-[56px] md:leading-[62px] md:tracking-[-1.4px] xl:text-[72px] xl:leading-[78px] xl:tracking-[-1.8px]">
              {doc.title}
            </h1>
            <p className="max-w-[720px] text-[16px] text-text-secondary leading-6 tracking-[-0.16px] md:text-[18px] md:leading-7 md:tracking-[-0.18px]">
              {doc.intro}
            </p>
            <p className="font-mono text-[10px] text-text-tertiary uppercase leading-[normal] tracking-[0.6px] md:text-[12px] md:tracking-[0.72px]">
              Last updated {doc.updated} · Effective {doc.effective}
            </p>
          </div>
        </div>
        <TileStrip tiles={tiles} className="absolute inset-x-0 bottom-0" />
      </section>

      <section className="border-border-soft border-t px-5 lg:px-8">
        <div className="mx-auto flex max-w-[1240px] items-start gap-20 border-border-soft border-r border-l px-4 py-10 md:px-10 md:py-20">
          <aside className="sticky top-24 hidden w-[300px] shrink-0 lg:block">
            <LegalToc items={toc} />
          </aside>

          <div className="flex min-w-0 flex-1 flex-col gap-7 md:gap-10">
            <div className="flex flex-col gap-3.5 rounded-2xl bg-bg-fill1 p-5 md:p-7">
              <h2 className="font-semibold text-[18px] text-text leading-7 tracking-[-0.18px]">
                The short version
              </h2>
              <Bullets items={doc.summary.map((point) => [point])} />
            </div>

            {doc.sections.map((section, i) => (
              <article key={section.id} id={section.id} className="flex flex-col gap-3.5">
                <h2 className="font-medium text-[22px] text-text leading-7 tracking-[-0.22px] md:text-[26px] md:leading-8 md:tracking-[-0.26px]">
                  {i + 1}. {section.title}
                </h2>
                {section.blocks.map((block, j) =>
                  "p" in block ? (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static copy, order never changes
                    <p key={j} className={BODY}>
                      <Text parts={block.p} />
                    </p>
                  ) : (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static copy, order never changes
                    <Bullets key={j} items={block.ul} />
                  ),
                )}
              </article>
            ))}

            <div
              id={doc.contact.id}
              className="flex flex-col gap-4 rounded-2xl bg-bg-fill1 p-5 md:flex-row md:items-center md:p-7"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <h2 className="font-semibold text-[18px] text-text leading-7 tracking-[-0.18px]">
                  {doc.sections.length + 1}. {doc.contact.title}
                </h2>
                <p className={BODY}>{doc.contact.text}</p>
              </div>
              <a
                href={`mailto:${doc.contact.email}`}
                className="btn-lift flex shrink-0 items-center justify-center self-start rounded-lg bg-text px-3 py-2.5 font-medium text-[16px] text-bg-base leading-6 tracking-[-0.16px]"
              >
                <span className="px-0.5">Email us</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
