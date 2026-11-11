"use client";

import { BTN_DARK, PageHeader, StateBlock } from "../../../../components/app-library/ui";

/** Figma "Library: couldn't load (error)": the header stays, with a Try again button. */
export default function LibraryError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
      <PageHeader
        title="Library"
        intro="Free videos, articles and tools picked by our curators. Search or filter to find what you need."
      />
      <StateBlock
        role="alert"
        glyph="library"
        large
        title="We couldn’t load the library"
        body="Check your connection and try again."
      >
        <button type="button" onClick={reset} className={BTN_DARK}>
          Try again
        </button>
      </StateBlock>
    </div>
  );
}
