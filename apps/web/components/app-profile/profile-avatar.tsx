"use client";

import { useState } from "react";
import { initials } from "../../lib/app/profile";

/**
 * The learner's photo, or their initials when there is none (or it cannot load). The photo comes
 * from the same-origin /api/avatars/... URL, so the CSP's img-src 'self' already allows it; a
 * blob: preview (a picked, not yet saved photo) is allowed too.
 */
const SIZES = {
  40: "size-10 text-[14px]",
  56: "size-14 text-[18px]",
  64: "size-16 text-[20px]",
  80: "size-20 text-[24px]",
} as const;

export function ProfileAvatar({
  url,
  name,
  size,
  className = "",
}: {
  url: string | null;
  name: string;
  size: keyof typeof SIZES;
  className?: string;
}) {
  // Remember which URL failed, so a new photo gets a fresh try.
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = url !== null && failed !== url;
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-focus font-semibold text-primary-text tracking-[-0.14px] ${SIZES[size]} ${className}`}
    >
      {showImage ? (
        <img
          src={url}
          alt=""
          width={size}
          height={size}
          onError={() => setFailed(url)}
          className="size-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initials({ name, email: "" })}</span>
      )}
    </span>
  );
}
