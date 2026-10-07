import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes. Replaced by lib/utils.ts once the Radian CLI components are promoted here. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
