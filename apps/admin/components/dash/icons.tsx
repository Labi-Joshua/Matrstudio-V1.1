import type { ReactNode } from "react";

function Icon({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const ClockIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="8" cy="8" r="6.25" />
    <path d="M8 4.5V8l2.2 1.4" />
  </Icon>
);

export const ExportIcon = () => (
  <Icon>
    <path d="M8 10V2.5M5.2 5.2 8 2.5l2.8 2.7M2.75 9.5v3.25h10.5V9.5" />
  </Icon>
);

export const CheckIcon = () => (
  <Icon>
    <path d="m3.5 8.5 3 3 6-7" />
  </Icon>
);

export const ChevronIcon = ({ dir }: { dir: "left" | "right" | "down" }) => (
  <Icon>
    {dir === "left" ? (
      <path d="m10 3.5-4.5 4.5 4.5 4.5" />
    ) : dir === "right" ? (
      <path d="m6 3.5 4.5 4.5L6 12.5" />
    ) : (
      <path d="m3.5 6 4.5 4.5L12.5 6" />
    )}
  </Icon>
);

export const ArrowLeftIcon = () => (
  <Icon>
    <path d="M13 8H3M7 3.5 2.5 8 7 12.5" />
  </Icon>
);

export const SlidersIcon = () => (
  <Icon>
    <circle cx="5" cy="4.5" r="1.75" />
    <circle cx="11" cy="11.5" r="1.75" />
    <path d="M7 4.5h6.5M2.5 11.5H9" />
  </Icon>
);

export const AlertIcon = ({ size = 20 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M8 2.2 14.2 13H1.8L8 2.2Z" />
    <path d="M8 6.5v3M8 11.4v.1" />
  </Icon>
);

export const InboxIcon = ({ size = 20 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M2 9.5 3.7 3.5h8.6L14 9.5v3H2v-3Z" />
    <path d="M2 9.5h3.5l.7 1.5h3.6l.7-1.5H14" />
  </Icon>
);

export const ChartIcon = ({ size = 20 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M2.5 2.5v11h11" />
    <path d="m5 10 2.5-3 2 1.5L13 4.5" />
  </Icon>
);
