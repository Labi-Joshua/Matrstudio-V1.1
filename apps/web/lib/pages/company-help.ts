/**
 * Copy for /help, from Figma "Marketing pages (V3)" > Page · Help centre (778:8561). The page is two
 * forms (contact support, report a problem) and a mailto line; there is no FAQ.
 */
export const HELP_EMAIL = "hello@matrstudio.com";

export const HELP_HERO = {
  eyebrow: "Help centre",
  title: "How can we help?",
  body: "Send us a message or report a problem. We reply by email within 2 working days.",
} as const;

export const HELP_CONTACT = {
  title: "Contact support",
  body: "Questions about your account, paths or anything else.",
  // Only "Account and sign-in" is visible in the Figma frames (the select is closed); the other
  // options are placeholders until the support categories are decided.
  topics: [
    "Account and sign-in",
    "Paths and lessons",
    "Library and resources",
    "Submitting a resource",
    "Something else",
  ],
  messagePlaceholder: "Tell us what you need help with.",
  emailHint: "We’ll reply to this address.",
  emailPlaceholder: "ada@example.com",
  submit: "Send message",
} as const;

export type ProblemIcon = "bug" | "link" | "file" | "question";

export const HELP_REPORT = {
  title: "Report a problem",
  body: "Something broken, a dead link or a lesson that doesn’t load? Tell us.",
  typeLabel: "What kind of problem is it?",
  types: [
    {
      id: "broken",
      label: "Something’s broken",
      hint: "A page, button or video isn’t working",
      icon: "bug",
    },
    {
      id: "link",
      label: "Broken link",
      hint: "A resource or lesson link doesn’t open",
      icon: "link",
    },
    {
      id: "content",
      label: "Wrong or outdated content",
      hint: "Something is incorrect or out of date",
      icon: "file",
    },
    {
      id: "other",
      label: "Something else",
      hint: "Anything that doesn’t fit above",
      icon: "question",
    },
  ],
  detailLabel: "What happened?",
  detailPlaceholder: "Tell us what you were doing and what went wrong.",
  linkLabel: "Page or link",
  linkPlaceholder: "Paste the page or resource link (optional)",
  screenshotLabel: "Screenshot",
  screenshotOptional: "(optional)",
  dropTitle: "Drag and drop files here",
  dropHint: "PNG or JPG (max. 10 MB)",
  submit: "Send report",
} as const satisfies {
  types: { id: string; label: string; hint: string; icon: ProblemIcon }[];
} & Record<string, unknown>;

export const HELP_EMAIL_LINE = "Prefer email? Write to";

export const MESSAGE_MAX = 1000;
export const SCREENSHOT_MAX_BYTES = 10 * 1024 * 1024;
