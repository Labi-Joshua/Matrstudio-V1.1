import Link from "next/link";
import { BackLink, BTN_PRIMARY, StateBlock } from "../../../../../components/app-library/ui";
import { ROUTES } from "../../../../../lib/routes";

/** Figma "Resource: not available (error)". */
export default function ResourceNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
      <BackLink href={ROUTES.app.library}>Library</BackLink>
      <StateBlock
        glyph="alert"
        title="This resource isn’t available"
        body="It may have been removed, or the link is wrong."
      >
        <Link href={ROUTES.app.library} className={BTN_PRIMARY}>
          Back to the library
        </Link>
      </StateBlock>
    </div>
  );
}
