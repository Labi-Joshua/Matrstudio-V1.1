/** First reply is due this many working days (Mon to Fri) after a request is opened. */
export const FIRST_REPLY_WORKING_DAYS = 2;
/** A request waiting on the learner resolves itself after this many days without a reply. */
export const AUTO_RESOLVE_DAYS = 7;

const DAY = 86400;

/** Working days (Mon to Fri) added to a unix time, keeping the time of day. */
export function addWorkingDays(from: number, days: number): number {
  let t = from;
  let left = days;
  while (left > 0) {
    t += DAY;
    const dow = new Date(t * 1000).getUTCDay();
    if (dow !== 0 && dow !== 6) left--;
  }
  return t;
}
