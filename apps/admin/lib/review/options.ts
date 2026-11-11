import type { DeclineReason } from "./types";

export const TYPE_OPTIONS = [
  { value: "article", label: "Article" },
  { value: "video", label: "Video" },
  { value: "tool", label: "Tool" },
  { value: "course", label: "Course" },
  { value: "other", label: "Other" },
];

export const LEVEL_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

/** Same topic slugs as the learner catalogue; Settings will own this list later. */
export const TOPIC_OPTIONS = [
  { value: "ui-ux", label: "UI and UX" },
  { value: "brand", label: "Brand" },
  { value: "product", label: "Product" },
  { value: "seo", label: "SEO" },
  { value: "social-media", label: "Social media design" },
  { value: "design-systems", label: "Design systems" },
  { value: "dev-handoff", label: "Dev handoff" },
];

export const DECLINE_REASONS: { value: DeclineReason; label: string; hint?: string }[] = [
  { value: "not_free", label: "Not free or public", hint: "Paywall, sign-up or private link" },
  {
    value: "not_a_fit",
    label: "Not a good fit for Matr Studio",
    hint: "Off-topic or too advanced for our paths",
  },
  { value: "low_quality", label: "Low quality or out of date" },
  { value: "other", label: "Something else" },
];

export const CHANGE_PRESETS = [
  "Explain why it helps beginners",
  "Pick the right level",
  "Use a free, public link",
];

export const HIDE_REASONS = [
  { value: "spam", label: "Spam or misleading links", phrase: "spam or misleading links" },
  { value: "offensive", label: "Offensive content", phrase: "offensive content" },
  { value: "impersonation", label: "Pretending to be someone else", phrase: "impersonation" },
  { value: "other", label: "Something else", phrase: "a breach of our guidelines" },
];

export const PLACEMENTS = [
  { value: "library", label: "Library only", hint: "Learners find it by browsing or searching" },
  { value: "library_and_path", label: "Library and a path", hint: "Also add it as a lesson" },
] as const;

export const labelOf = (options: { value: string; label: string }[], value: string | null) =>
  options.find((o) => o.value === value)?.label ?? value ?? "";
