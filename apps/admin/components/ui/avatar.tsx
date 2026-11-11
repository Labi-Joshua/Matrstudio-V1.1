import { type AdminMe, initials } from "../../lib/session/types";

/** Initials in an orange-tinted circle (admins have no photos). */
export function Avatar({
  me,
  size,
}: {
  me: Pick<AdminMe, "name" | "email">;
  size: 24 | 36 | 40 | 48;
}) {
  const box =
    size === 24
      ? "size-6 text-[10px]"
      : size === 36
        ? "size-9 text-[13px]"
        : size === 40
          ? "size-10 text-sm"
          : "size-12 text-base";
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary-focus font-semibold text-primary-text tracking-[-0.14px] ${box}`}
    >
      {initials(me)}
    </span>
  );
}
