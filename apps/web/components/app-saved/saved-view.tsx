"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildLibraryModel } from "../../lib/app/library-data";
import { applyFilters, type TypeFilter } from "../../lib/app/library-filters";
import { resolveSaved, savedCountText } from "../../lib/app/saved-state";
import { getCatalogue } from "../../lib/catalogue/data";
import { ROUTES } from "../../lib/routes";
import { SampleTag } from "../app-library/art";
import { useSkeletonGate } from "../app-library/browse-loading";
import { SelectMenu, typeOptions } from "../app-library/filters";
import { LibraryCard } from "../app-library/resource-card";
import { BTN_PRIMARY, BTN_SECONDARY, PageHeader, StateBlock } from "../app-library/ui";
import { SavedListSkeleton } from "./saved-loading";
import { useSaved } from "./saved-provider";

const INTRO = "Resources you’ve bookmarked. They stay here until you remove them.";

/**
 * /learn/saved (Figma "Saved: your saved resources", "removed, with undo", "nothing saved yet"):
 * the learner's bookmarks as the same cards as the library, newest saved first, with a Type
 * filter. Ids are resolved against the current catalogue and ones that no longer exist are
 * skipped silently. States: loading skeleton, "couldn't load" with Try again, empty with Browse
 * the library. A removed card leaves at once and the toast offers Undo (saved-provider.tsx).
 */
export function SavedView() {
  const { status, ids, reload } = useSaved();
  const model = useMemo(() => buildLibraryModel(getCatalogue()), []);
  const [type, setType] = useState<TypeFilter>("all");
  const headingRef = useRef<HTMLHeadingElement>(null);

  const items = useMemo(() => resolveSaved(ids, model.items), [ids, model.items]);
  const shown = useMemo(
    () => applyFilters(items, { topic: "all", source: "all", type }),
    [items, type],
  );

  // The card that held focus is gone after a remove: keep the keyboard on the page, not on <body>.
  const count = items.length;
  const previous = useRef(count);
  useEffect(() => {
    if (count < previous.current && document.activeElement === document.body) {
      headingRef.current?.focus();
    }
    previous.current = count;
  }, [count]);

  const loading = status === "loading";
  const gate = useSkeletonGate(loading);
  const sample = items.some((item) => item.sample);

  return (
    <div className="mx-auto flex w-full flex-col gap-6">
      <PageHeader
        title="Saved"
        headingRef={headingRef}
        intro={INTRO}
        aside={sample ? <SampleTag /> : undefined}
      />

      {loading || gate ? (
        <SavedListSkeleton visible={gate} />
      ) : status === "error" ? (
        <StateBlock
          role="alert"
          glyph="alert"
          title="Couldn’t load your saved resources"
          body="Check your connection and try again. Nothing you saved has been lost."
        >
          <button type="button" onClick={reload} className={BTN_PRIMARY}>
            Try again
          </button>
          <Link href={ROUTES.app.library} className={BTN_SECONDARY}>
            Browse the library
          </Link>
        </StateBlock>
      ) : count === 0 ? (
        <StateBlock
          glyph="saved"
          title="Nothing saved yet"
          body="Tap the bookmark on any resource to keep it here for later."
        >
          <Link href={ROUTES.app.library} className={BTN_PRIMARY}>
            Browse the library
          </Link>
        </StateBlock>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p
              aria-live="polite"
              aria-atomic="true"
              className="text-[13px] text-text-tertiary leading-5 tracking-[-0.13px]"
            >
              {type === "all"
                ? savedCountText(count)
                : `${shown.length} of ${savedCountText(count)}`}
            </p>
            <SelectMenu
              label="Type"
              options={typeOptions()}
              value={type}
              onChange={(next) => setType(next as TypeFilter)}
            />
          </div>
          {shown.length === 0 ? (
            <StateBlock
              glyph="filter"
              title="No saved resources of this type"
              body="Try another type, or show everything you’ve saved."
            >
              <button type="button" onClick={() => setType("all")} className={BTN_SECONDARY}>
                Show all types
              </button>
            </StateBlock>
          ) : (
            <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {shown.map((item) => (
                <li key={item.id}>
                  <LibraryCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
