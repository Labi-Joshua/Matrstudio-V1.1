/**
 * Where Tab should go inside a modal so focus never leaves it. `count` is the number of focusable
 * elements, `active` the index of the focused one (-1 when focus is outside the list). Returns the
 * index to move to, or null to let the browser move focus normally.
 */
export function trapTarget(count: number, active: number, backwards: boolean): number | null {
  if (count === 0) return null;
  if (backwards) return active <= 0 ? count - 1 : null;
  return active === -1 || active === count - 1 ? 0 : null;
}
