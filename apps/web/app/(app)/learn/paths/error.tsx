"use client";

import { BUTTON_INVERSE, ErrorState } from "../../../../components/app-paths/parts";

/** "Catalogue: couldn't load (error)": shown when rendering the catalogue throws. */
export default function PathsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState title="We couldn’t load paths" body="Check your connection and try again.">
      <button type="button" onClick={reset} className={BUTTON_INVERSE}>
        Try again
      </button>
    </ErrorState>
  );
}
