import { HELP_EMAIL } from "../../lib/app/help-form";
import { UploadIcon } from "../app/icons";

/**
 * Figma "Screenshot (optional)" drop zone, drawn but switched off: the support API takes text
 * only and there is no upload endpoint, so the box says so instead of accepting a file it would
 * drop. TODO(uploads): make it a real PNG/JPG (max 10 MB) picker once an upload endpoint exists.
 */
export function ScreenshotField() {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <p className="flex items-baseline gap-1 font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
        Screenshot
        <span className="font-normal text-text-tertiary">(optional)</span>
      </p>
      <div
        aria-disabled="true"
        className="flex flex-col items-center gap-1.5 rounded-xl border border-border border-dashed bg-bg-fill1 px-4 py-6 text-center"
      >
        <span
          aria-hidden="true"
          className="mb-1 flex size-9 items-center justify-center rounded-lg border border-border bg-bg-base text-text-tertiary shadow-e1"
        >
          <UploadIcon size={20} />
        </span>
        <p className="font-medium text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          Screenshots can’t be uploaded yet
        </p>
        <p className="max-w-[420px] text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
          Describe what you saw in the message above, or write to {HELP_EMAIL} with the image
          attached.
        </p>
      </div>
    </div>
  );
}
