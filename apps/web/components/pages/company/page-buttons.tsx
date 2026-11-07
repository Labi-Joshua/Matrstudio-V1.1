import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Buttons of the V3 marketing pages (Figma "Button-Primary", 48px tall): the filled brand button
 * and the outlined elevation button. Links, never <button>, since both just navigate.
 */
const BASE =
  "btn-lift flex h-12 items-center justify-center rounded-lg px-3.5 py-3 font-medium text-[16px] leading-6 tracking-[-0.16px]";

export function FilledLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={`${BASE} bg-primary text-static-white`}>
      <span className="px-0.5">{children}</span>
    </Link>
  );
}

export function OutlineLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`${BASE} border border-border bg-bg-elevation-1 text-text shadow-[0_1px_1px_rgba(25,24,27,0.04)]`}
    >
      <span className="px-0.5">{children}</span>
    </Link>
  );
}
