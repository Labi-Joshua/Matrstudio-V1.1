import type { ReactNode } from "react";

function Svg({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

export const CheckIcon = () => (
  <Svg>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
export const AlertIcon = () => (
  <Svg>
    <path d="M12 8v5M12 16.5v.01" />
    <path d="M10.3 4.2 2.9 17.2a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
  </Svg>
);
export const CrossIcon = () => (
  <Svg>
    <path d="m6 6 12 12M18 6 6 18" />
  </Svg>
);
export const ArrowLeftIcon = () => (
  <Svg>
    <path d="M19 12H5m6-6-6 6 6 6" />
  </Svg>
);
export const ChevronDownIcon = () => (
  <Svg>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
export const FilterIcon = () => (
  <Svg>
    <path d="M4 7h16M7 12h10M10 17h4" />
  </Svg>
);
export const MailIcon = () => (
  <Svg size={20}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m4 7 8 6 8-6" />
  </Svg>
);
export const TrashIcon = () => (
  <Svg size={20}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </Svg>
);
export const CopyIcon = () => (
  <Svg size={20}>
    <rect x="8" y="8" width="12" height="12" rx="2.5" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </Svg>
);
export const LockIcon = () => (
  <Svg size={20}>
    <rect x="5" y="11" width="14" height="9" rx="2.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Svg>
);
export const LinkIcon = () => (
  <Svg size={20}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Svg>
);
export const LogIcon = () => (
  <Svg>
    <path d="M7 4h11v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2h3M8 9h6M8 13h6" />
  </Svg>
);
export const InboxIcon = () => (
  <Svg size={22}>
    <path d="M4 13h4l1.5 2.5h5L16 13h4M4 13l2-7h12l2 7v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5Z" />
  </Svg>
);
