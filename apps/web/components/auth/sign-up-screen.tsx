"use client";

import { useState } from "react";
import { CheckInbox } from "./check-inbox";
import { CreateAccountForm } from "./create-account-form";

/**
 * /sign-up: the create account form, then "Check your inbox" in the same page once the API has
 * queued the confirmation email. "Change it" goes back to a fresh form. The email is held in
 * state only.
 */
export function SignUpScreen() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  if (sentTo) return <CheckInbox email={sentTo} onChangeEmail={() => setSentTo(null)} />;
  return <CreateAccountForm onCreated={setSentTo} />;
}
