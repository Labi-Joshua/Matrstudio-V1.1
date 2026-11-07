import type { SVGProps } from "react";

/**
 * Icons of the auth screens (Figma icon set, 20px, 1.5 stroke), drawn as inline SVG so they take
 * the text colour. They are decoration: pair them with text, never rely on them alone.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
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

export const EyeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M1.72 10.29a.8.8 0 0 1 0-.58C2.39 8.07 3.54 6.67 5.02 5.68 6.49 4.69 8.23 4.17 10 4.17s3.51.52 4.98 1.51c1.48.99 2.63 2.39 3.3 4.03.07.19.07.4 0 .58-.67 1.64-1.82 3.04-3.3 4.03-1.47.99-3.21 1.51-4.98 1.51s-3.51-.52-4.98-1.51c-1.48-.99-2.63-2.39-3.3-4.03Z" />
    <circle cx="10" cy="10" r="2.5" />
  </Icon>
);

export const EyeOffIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8.3 4.3A8.3 8.3 0 0 1 10 4.17c1.77 0 3.51.52 4.98 1.51 1.48.99 2.63 2.39 3.3 4.03.07.19.07.4 0 .58a8.4 8.4 0 0 1-1.1 1.9M11.8 11.8a2.5 2.5 0 0 1-3.6-3.6M5.1 5.7a8.4 8.4 0 0 0-3.38 4 .8.8 0 0 0 0 .58c.67 1.64 1.82 3.04 3.3 4.03a8.3 8.3 0 0 0 7.1 1M2.5 2.5l15 15" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p} strokeWidth="2">
    <path d="m4.5 10.5 3.5 3.5 7.5-8" />
  </Icon>
);

export const CircleAlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="8" />
    <path d="M10 6.5v4M10 13.5h.01" />
  </Icon>
);

export const TriangleAlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8.57 3.22 1.52 15a1.67 1.67 0 0 0 1.43 2.5h14.1A1.67 1.67 0 0 0 18.48 15L11.43 3.22a1.67 1.67 0 0 0-2.86 0ZM10 7.5v3.33M10 14.17h.01" />
  </Icon>
);

export const InfoIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="8" />
    <path d="M10 13.5V10M10 6.5h.01" />
  </Icon>
);

export const CircleCheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="8" />
    <path d="m6.8 10.2 2.2 2.2 4.2-4.6" />
  </Icon>
);

export const MailIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="4" width="15" height="12" rx="2" />
    <path d="m2.9 5.6 6.1 4.4a1.7 1.7 0 0 0 2 0l6.1-4.4" />
  </Icon>
);

export const ClockAlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M17.5 9.2A7.5 7.5 0 1 0 10 17.5M10 5.8V10l2.6 1.6M16.5 12.5v2M16.5 17.5h.01" />
  </Icon>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16 10H4M9 5l-5 5 5 5" />
  </Icon>
);

export const XIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 5 10 10M15 5 5 15" />
  </Icon>
);

export function SpinnerIcon({ size = 16, className = "", ...rest }: IconProps) {
  return (
    <Icon size={size} className={`animate-spin motion-reduce:animate-none ${className}`} {...rest}>
      <circle cx="10" cy="10" r="7.5" opacity="0.25" />
      <path d="M17.5 10A7.5 7.5 0 0 0 10 2.5" />
    </Icon>
  );
}

/** Google "G" in the brand's own colours (these are Google's, not theme tokens). */
export function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
