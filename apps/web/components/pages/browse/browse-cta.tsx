import type { ReactNode } from "react";

/** The rounded account-prompt card that closes the browse pages (Figma "CTA" frames). */
export function BrowseCta({
  id,
  title,
  text,
  children,
}: {
  id: string;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="border-border-soft border-t px-5 lg:px-8">
      <div className="mx-auto max-w-[1240px] border-border-soft border-r border-l px-4 py-12 md:px-10 xl:py-24">
        <div className="flex flex-col items-center gap-4 rounded-[20px] bg-bg-fill1 px-5 py-8 md:gap-6 md:rounded-[28px] md:p-12 xl:p-16">
          <h2
            id={id}
            className="text-center font-medium text-[28px] text-text leading-[34px] tracking-[-0.56px] md:text-[44px] md:leading-[50px] md:tracking-[-0.88px]"
          >
            {title}
          </h2>
          <p className="max-w-[760px] text-center text-[16px] text-text-secondary leading-6 tracking-[-0.16px] md:text-[18px] md:leading-7 md:tracking-[-0.18px]">
            {text}
          </p>
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">{children}</div>
        </div>
      </div>
    </section>
  );
}
