"use client";

import { BUTTON_INVERSE, ErrorState } from "../../../../components/app-paths/parts";

/** "Catalogue: couldn't load (error)": the page header stays, the body says so and offers a retry. */
export default function PathsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-2">
      <h1 className="font-semibold text-[24px] text-text leading-8 tracking-[-0.24px]">
        Learning paths
      </h1>
      <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px] md:text-[16px] md:leading-6 md:tracking-[-0.16px]">
        Structured paths built from the best free videos and articles.
      </p>
      <ErrorState
        level={2}
        title="We couldn’t load paths"
        body="Check your connection and try again."
      >
        <button type="button" onClick={reset} className={BUTTON_INVERSE}>
          Try again
        </button>
      </ErrorState>
    </div>
  );
}
