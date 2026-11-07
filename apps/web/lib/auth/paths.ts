import { ROUTES } from "../routes";
import type { Me } from "./api";

/**
 * Where a learner goes once signed in: onboarding until they have finished it, then the
 * dashboard (Figma "Flow connectors": "Exit: Onboarding or Home").
 */
export function postAuthPath(me: Pick<Me, "onboarding"> | null | undefined): string {
  if (me && !me.onboarding.completed) return ROUTES.onboarding;
  return ROUTES.dashboard;
}
