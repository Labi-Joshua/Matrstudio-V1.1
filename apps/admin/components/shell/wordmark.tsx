/** "matrstudio." wordmark; swaps with the theme (assets copied from the learner app). */
export function Wordmark() {
  return (
    <>
      <img
        src="/images/logo-nav.svg"
        alt=""
        width={127}
        height={20}
        className="block h-5 w-auto dark:hidden"
      />
      <img
        src="/images/logo-nav-dark.svg"
        alt=""
        width={127}
        height={20}
        className="hidden h-5 w-auto dark:block"
      />
    </>
  );
}

/** The wordmark is an image of text: this is its accessible name when it links home. */
export const WORDMARK_LABEL = "Matr Studio admin home";

/** Small "m." mark for the icon rail. */
export function Mark() {
  return (
    <span
      aria-hidden="true"
      className="flex size-10 items-center justify-center font-semibold text-[20px] text-text tracking-[-0.6px]"
    >
      m<span className="text-primary">.</span>
    </span>
  );
}
