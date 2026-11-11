/**
 * Loading placeholders for Your requests and the request page: grey blocks in the shape of the
 * screen, with a visually hidden status. They are only drawn once the gate in components/app/hooks
 * (useSkeletonGate) lets them show, and the pulse is off under prefers-reduced-motion.
 */
const BAR = "rounded-md bg-bg-fill2 motion-safe:animate-pulse";

export function RequestsSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-3">
      <p className="sr-only">Loading your requests</p>
      <div aria-hidden="true" className={`${BAR} h-4 w-40`} />
      {["a", "b", "c"].map((key) => (
        <div
          key={key}
          aria-hidden="true"
          className="flex items-center gap-3 rounded-xl border border-border-soft bg-bg-base p-3"
        >
          <div className={`${BAR} size-9 shrink-0 rounded-lg`} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className={`${BAR} h-4 w-2/3 max-w-[260px]`} />
            <div className={`${BAR} h-3 w-full max-w-[380px]`} />
          </div>
          <div className={`${BAR} h-6 w-16 shrink-0 rounded-full`} />
        </div>
      ))}
    </div>
  );
}

export function RequestSkeleton() {
  return (
    <div role="status" className="flex w-full max-w-[820px] flex-col gap-4">
      <p className="sr-only">Loading your request</p>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className={`${BAR} h-8 w-3/4 max-w-[420px]`} />
        <div className={`${BAR} h-6 w-20 rounded-full`} />
        <div className={`${BAR} h-4 w-full max-w-[360px]`} />
      </div>
      {["a", "b"].map((key) => (
        <div
          key={key}
          aria-hidden="true"
          className="flex flex-col gap-3 rounded-xl border border-border-soft bg-bg-base p-4"
        >
          <div className="flex items-center gap-3">
            <div className={`${BAR} size-8 shrink-0 rounded-lg`} />
            <div className={`${BAR} h-4 w-32`} />
          </div>
          <div className={`${BAR} h-4 w-full`} />
          <div className={`${BAR} h-4 w-2/3`} />
        </div>
      ))}
    </div>
  );
}
