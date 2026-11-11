import type { ReactNode, SVGProps } from "react";

/** Lucide glyphs the Paths screens need beyond the shell's set (components/app/icons.tsx). */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Glyph({ size = 18, children, ...rest }: IconProps & { children: ReactNode }) {
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

export const ArrowLeftIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="m12 19-7-7 7-7M19 12H5" />
  </Glyph>
);

export const ExternalLinkIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </Glyph>
);

export const FunnelXIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12.531 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14.001V21l4-2v-4.999M16.5 3.5l5 5M21.5 3.5l-5 5" />
  </Glyph>
);

export const CirclePlayIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M10 8.5v7l6-3.5z" />
  </Glyph>
);

export const CheckIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Glyph>
);

export const SignalIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16" />
  </Glyph>
);

export const BadgeDollarIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 18V6" />
  </Glyph>
);

export const WrenchIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4Z" />
  </Glyph>
);

export const SlidersIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="8" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Glyph>
);

export const StarIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
  </Glyph>
);
