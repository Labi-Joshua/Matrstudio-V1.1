/**
 * Loading placeholders (Figma "Library: loading", "Resource: loading"): grey blocks in the shape
 * of the screen. The page is static, so these show while the search-params boundary resolves.
 */
const BAR = "rounded-md bg-bg-fill2 motion-safe:animate-pulse";

function Loading({ label }: { label: string }) {
  return <p className="sr-only">{label}</p>;
}

export function LibrarySkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto flex w-full max-w-[1240px] flex-col gap-6"
    >
      <Loading label="Loading the library" />
      <div className="flex flex-col gap-2" aria-hidden="true">
        <div className={`${BAR} h-9 w-40`} />
        <div className={`${BAR} h-5 w-full max-w-[520px]`} />
      </div>
      <div className="flex gap-2 overflow-hidden" aria-hidden="true">
        {["a", "b", "c", "d", "e", "f"].map((key) => (
          <div key={key} className={`${BAR} h-8 w-20 shrink-0 rounded-full`} />
        ))}
      </div>
      <div className={`${BAR} h-4 w-44`} aria-hidden="true" />
      <div
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
        aria-hidden="true"
      >
        {["a", "b", "c", "d", "e", "f", "g", "h"].map((key) => (
          <div key={key} className={`${BAR} h-[260px] rounded-2xl`} />
        ))}
      </div>
    </div>
  );
}

export function ResourceSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto flex w-full max-w-[1240px] flex-col gap-6"
    >
      <Loading label="Loading the resource" />
      <div className={`${BAR} h-5 w-20`} aria-hidden="true" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" aria-hidden="true">
        <div className="flex flex-col gap-4">
          <div className={`${BAR} h-3 w-48`} />
          <div className={`${BAR} h-9 w-3/4`} />
          <div className={`${BAR} aspect-video w-full rounded-2xl`} />
          <div className={`${BAR} h-24 w-full rounded-xl`} />
          <div className="flex gap-2">
            <div className={`${BAR} h-10 w-24`} />
            <div className={`${BAR} h-10 w-40`} />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className={`${BAR} h-32 rounded-2xl`} />
          <div className={`${BAR} h-72 rounded-2xl`} />
        </div>
      </div>
    </div>
  );
}
