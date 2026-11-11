import type { SVGProps } from "react";

/** Lucide-style glyphs the Help centre needs and the shared sets lack (24px grid, 1.5 stroke). */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Glyph({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const BugIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="m8 2 1.9 1.9M14.1 3.9 16 2M9 7.1V6a3 3 0 0 1 6 0v1.1" />
    <path d="M12 20a6 6 0 0 1-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3a6 6 0 0 1-6 6Z" />
    <path d="M12 20v-9M6.5 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 21c0-2.1-1.7-3.9-3.8-4M22 13h-4.5M3 5a4 4 0 0 0 3.2 3.9M21 5a4 4 0 0 1-3.2 3.9" />
  </Glyph>
);

export const MessageCircleIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </Glyph>
);

export const MessageCircleQuestionIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
  </Glyph>
);

export const LinkBrokenIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71M8 2v3M2 8h3M16 22v-3M22 16h-3" />
  </Glyph>
);
