/** Shapes of the Settings API (spec D, section "Settings") as the UI uses them. */

export const TAXONOMY_KINDS = ["topic", "tag", "level"] as const;
export type TaxonomyKind = (typeof TAXONOMY_KINDS)[number];
export const KIND_LABEL: Record<TaxonomyKind, string> = {
  topic: "Topic",
  tag: "Tag",
  level: "Level",
};

export type TaxonomyItem = {
  id: string;
  kind: TaxonomyKind;
  name: string;
  resources: number;
  paths: number;
};

export type TaxonomyUsage = { resources: number; paths: number };

export type CuratedPath = { id: string; title: string; level: string; learners: number | null };
export type CuratedResource = { id: string; title: string; kind: string; minutes: number | null };

export const RANK_OPTIONS = [
  { value: "saves_completions", label: "Saves and completions" },
  { value: "saves", label: "Saves" },
  { value: "completions", label: "Completions" },
] as const;
export const WINDOW_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
] as const;

export type PopularRules = {
  rankBy: string;
  window: string;
  hideReported: boolean;
  /** Minimum learners before an item can be "popular"; null when the rule is off. */
  minLearners: number | null;
};

export type HomeCuration = {
  featuredPaths: CuratedPath[];
  libraryPicks: CuratedResource[];
  popular: PopularRules;
};

/** What PUT /settings/home-curation takes. */
export type HomeCurationInput = {
  featuredPaths: string[];
  libraryPicks: string[];
  popularRules: PopularRules;
};

export type EmailTemplate = {
  key: string;
  name: string;
  when: string;
  subject: string;
  body: string;
  variables: string[];
  /** Label of the button in the email, when the template has one. */
  cta: string | null;
};

export type NudgeRules = {
  enabled: boolean;
  firstAfterDays: number;
  secondAfterDays: number;
  maxPerWeek: number;
};

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type QueueTargets = {
  submissionDays: number;
  linkReportDays: number;
  firstReplyDays: number;
  autoResolveDays: number;
  workingDays: Weekday[];
};

export type SettingsTab = "topics" | "home" | "templates" | "nudges" | "targets";
