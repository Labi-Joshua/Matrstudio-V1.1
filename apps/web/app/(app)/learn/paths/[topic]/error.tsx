"use client";

import { BUTTON_INVERSE, ErrorState } from "../../../../../components/app-paths/parts";

/** Rendering a path threw: say so and offer a retry (the "not available" state is for missing paths). */
export default function PathError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState title="We couldn’t load this path" body="Check your connection and try again.">
      <button type="button" onClick={reset} className={BUTTON_INVERSE}>
        Try again
      </button>
    </ErrorState>
  );
}
