/**
 * Loading placeholders (Figma "My submissions: loading" and the form while the page loads). Grey
 * blocks in the shape of the screen; the pulse is off under prefers-reduced-motion.
 */
const BAR = "rounded-md bg-bg-fill2 motion-safe:animate-pulse";

export function SubmissionsSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <p className="sr-only">Loading your submissions</p>
      <div aria-hidden="true" className={`${BAR} h-5 w-28`} />
      <div aria-hidden="true" className="flex flex-col gap-3">
        {["a", "b", "c", "d"].map((key) => (
          <div
            key={key}
            className="flex items-center gap-3 rounded-xl border border-border-soft bg-bg-base py-3 pr-3.5 pl-3"
          >
            <div className={`${BAR} size-10 shrink-0 rounded-[10px]`} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className={`${BAR} h-4 w-2/3 max-w-[260px]`} />
              <div className={`${BAR} h-3 w-full max-w-[380px]`} />
            </div>
            <div className={`${BAR} h-6 w-20 shrink-0`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto flex w-full max-w-[1240px] flex-col gap-6"
    >
      <p className="sr-only">Loading the form</p>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className={`${BAR} h-9 w-56`} />
        <div className={`${BAR} h-5 w-full max-w-[460px]`} />
      </div>
      <div aria-hidden="true" className={`${BAR} h-10 w-72 rounded-xl`} />
      <div
        aria-hidden="true"
        className="flex w-full max-w-[560px] flex-col gap-5 md:mx-auto md:rounded-3xl md:border md:border-border-soft md:p-8"
      >
        <div className={`${BAR} h-28 rounded-2xl`} />
        <div className={`${BAR} h-9`} />
        <div className={`${BAR} h-9`} />
        <div className={`${BAR} h-24`} />
        <div className="flex justify-end gap-3">
          <div className={`${BAR} h-9 w-20`} />
          <div className={`${BAR} h-9 w-36`} />
        </div>
      </div>
    </div>
  );
}
