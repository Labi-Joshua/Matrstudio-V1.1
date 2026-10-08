import { cn } from "@matr/ui";

// Pill buttons for the email-confirmation pages (Figma Button-Primary, primary and secondary).
const button =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2.5 font-medium text-sm leading-5 tracking-[-0.14px] transition-all duration-500 ease-smooth hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:translate-y-0 disabled:opacity-60";

/** Orange pill button (Figma Button-Primary, primary/key). */
export const primaryButton = cn(
  button,
  "bg-primary text-white hover:shadow-[0_8px_20px_-8px_rgba(214,92,31,0.7)]",
);

/** White/elevated pill with a border (Figma Button-Primary, secondary style). */
export const secondaryButton = cn(
  button,
  "border border-border bg-bg-elevation-1 text-text shadow-e1 hover:border-text-secondary/40",
);
