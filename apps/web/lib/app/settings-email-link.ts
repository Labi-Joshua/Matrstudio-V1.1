/**
 * /settings/confirm-email: where the link in the "confirm your new email" message lands. The API
 * redirects here after GET /api/auth/verify-email, with ?error=link_expired | link_invalid |
 * already_confirmed on failure and no error on success. A successful change signs every session
 * out, so the success view sends the learner to sign in with the new address.
 */
export type ConfirmEmailView = "changed" | "expired" | "invalid" | "used";

export function confirmEmailView(error: string | null): ConfirmEmailView {
  switch (error) {
    case null:
    case "":
      return "changed";
    case "link_expired":
      return "expired";
    case "already_confirmed":
      return "used";
    default:
      return "invalid";
  }
}
