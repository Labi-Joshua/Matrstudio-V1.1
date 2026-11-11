"use client";

import Link from "next/link";
import { BTN_PRIMARY, BTN_SECONDARY, StateBlock } from "../../../../../components/app-library/ui";
import { ROUTES } from "../../../../../lib/routes";

export default function ResourceError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full flex-col gap-6">
      <StateBlock
        role="alert"
        glyph="alert"
        title="We couldn’t load this resource"
        body="Check your connection and try again."
      >
        <button type="button" onClick={reset} className={BTN_PRIMARY}>
          Try again
        </button>
        <Link href={ROUTES.app.library} className={BTN_SECONDARY}>
          Back to the library
        </Link>
      </StateBlock>
    </div>
  );
}
