// Email templates admins can edit (Settings, Email templates). Defaults live here; an override is a
// row in email_templates. Variables are written {{name}}; only the ones listed for a template are
// allowed, so a typo is refused when saving instead of being sent to a learner.

export type TemplateDef = {
  key: string;
  label: string;
  usedBy: string;
  variables: string[];
  subject: string;
  body: string;
  /** True when the sending code reads the stored template. Others are stored for later wiring. */
  wired: boolean;
};

export const TEMPLATES: TemplateDef[] = [
  {
    key: "waitlist-invite",
    label: "Waitlist invite",
    usedBy: "Sent with each invite batch",
    variables: ["name", "link"],
    subject: "You’re in: your Matr Studio invite",
    body: "Hi {{name}},\n\nYour spot is ready. Use this link to create your account: {{link}}\n\nThe link works for 14 days.",
    wired: false,
  },
  {
    key: "confirm-email",
    label: "Confirm your email",
    usedBy: "After sign-up",
    variables: ["name", "link"],
    subject: "Confirm your email to finish setting up Matr Studio",
    body: "Hi {{name}},\n\nOne click and your account is ready: {{link}}",
    wired: false,
  },
  {
    key: "continue-learning",
    label: "Continue learning",
    usedBy: "Nudge rules",
    variables: ["name", "path", "lesson", "progress"],
    subject: "{{name}}, lesson {{lesson}} is waiting",
    body: "You’re {{progress}}% of the way through {{path}}. Pick up where you left off whenever you’re ready.",
    wired: false,
  },
  {
    key: "submission-approved",
    label: "Submission approved",
    usedBy: "Review queues",
    variables: ["name", "title"],
    subject: "Your resource is live on Matr Studio",
    body: "Hi {{name}},\n\nThanks for sharing “{{title}}”. We added it to the library and credited you.",
    wired: true,
  },
  {
    key: "submission-declined",
    label: "Submission declined",
    usedBy: "Request a change",
    variables: ["name", "title", "reason"],
    subject: "About your resource suggestion",
    body: "Hi {{name}},\n\nThanks for suggesting “{{title}}”. We didn’t add it this time: {{reason}}\n\nYou’re welcome to submit again.",
    wired: true,
  },
  {
    key: "support-reply",
    label: "Support reply",
    usedBy: "Support inbox",
    variables: ["name", "subject", "message"],
    subject: "Matr Studio support replied to you",
    body: "Hi {{name}},\n\n{{message}}",
    wired: false,
  },
];

export const templateByKey = (key: string) => TEMPLATES.find((t) => t.key === key);

const VAR = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** Variables used in `text` that the template does not allow. */
export function unknownVariables(text: string, allowed: string[]): string[] {
  const bad = new Set<string>();
  for (const m of text.matchAll(VAR))
    if (!allowed.includes(m[1] as string)) bad.add(m[1] as string);
  return [...bad];
}

export const render = (text: string, values: Record<string, string>) =>
  text.replace(VAR, (_, k: string) => values[k] ?? "");

export const SAMPLE: Record<string, string> = {
  name: "Ada",
  link: "https://matrstudio.com/example-link",
  path: "UI/UX Foundations",
  lesson: "10",
  progress: "38",
  title: "Spacing and rhythm in UI",
  reason: "it duplicates something already in the library.",
  subject: "Quiz five fails",
  message: "Thanks for the report, we have fixed it.",
};

export async function loadTemplate(db: D1Database, key: string) {
  const def = templateByKey(key);
  if (!def) return null;
  const row = await db
    .prepare("SELECT subject, body, updated_at FROM email_templates WHERE key = ?")
    .bind(key)
    .first<{ subject: string; body: string; updated_at: number }>();
  return {
    def,
    subject: row?.subject ?? def.subject,
    body: row?.body ?? def.body,
    customised: row !== null,
    updatedAt: row?.updated_at ?? null,
  };
}
