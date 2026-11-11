"use client";

import { BUTTON_INVERSE, ErrorState } from "../../../../../../../../components/app-paths/parts";

/** Rendering a lesson threw: say so and offer a retry (a missing lesson has its own state). */
export default function LessonError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState title="We couldn’t load this lesson" body="Check your connection and try again.">
      <button type="button" onClick={reset} className={BUTTON_INVERSE}>
        Try again
      </button>
    </ErrorState>
  );
}
