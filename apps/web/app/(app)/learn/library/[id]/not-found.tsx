import Link from "next/link";
import { BTN_PRIMARY, StateBlock } from "../../../../../components/app-library/ui";
import { ROUTES } from "../../../../../lib/routes";

/** Figma "Resource: not available (error)": no back link, just the message and one way out. */
export default function ResourceNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
      <StateBlock
        glyph="alert"
        title="This resource isn’t available"
        body="It was retired from the library or the link is wrong."
      >
        <Link href={ROUTES.app.library} className={BTN_PRIMARY}>
          Back to the library
        </Link>
      </StateBlock>
    </div>
  );
}
