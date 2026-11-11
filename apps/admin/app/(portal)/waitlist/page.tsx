import { redirect } from "next/navigation";

// The waitlist is a tab inside /users; this keeps /waitlist links working.
export default function Page() {
  redirect("/users?tab=waitlist");
}
