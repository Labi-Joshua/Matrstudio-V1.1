/**
 * Response shapes for GET /api/admin/dashboard and GET /api/admin/metrics/*. Numbers are raw (the
 * UI formats them); comparison with the previous period is computed from `value` and `previous`.
 */
export type StatUnit = "count" | "percent" | "minutes";

export type Stat = {
  key: string;
  label: string;
  value: number;
  /** Same figure for the previous period; null when there is no earlier data. */
  previous: number | null;
  unit: StatUnit;
  /** Which direction is an improvement ("down" for open requests, unsubscribes). */
  better: "up" | "down" | "neutral";
  /** "relative" shows a percentage change, "absolute" the difference (points for percent stats). */
  compare: "relative" | "absolute";
};

export type Series = {
  title: string;
  labels: string[];
  current: (number | null)[];
  previous: (number | null)[];
};

export type QueueKind = "submission" | "broken_link" | "help_request" | "profile_report";

export type QueueItem = {
  id: string;
  kind: QueueKind;
  title: string;
  /** "Submission · waiting 6 days" (the API composes it; support uses "category · age"). */
  meta: string;
  overTarget: boolean;
  href: string;
};

export type AttentionItem = { id: string; text: string; linkLabel: string; href: string };
export type NoResultSearch = { term: string; count: number; periodLabel: string };
export type ActivityItem = {
  id: string;
  actor: string;
  action: string;
  detail: string;
  at: string;
  href: string | null;
};
export type AtRiskLearner = { id: string; email: string; reason: string; href: string };

export type Dashboard = {
  variant: "admin" | "curator" | "support";
  firstName: string | null;
  /** Subtitle override ("12 submissions are waiting for review."); null means "Here's what needs attention." */
  headline: string | null;
  /** True before any learner activity exists: the first-time empty dashboard. */
  firstTime: boolean;
  attention: AttentionItem[];
  stats: Stat[];
  series: Series | null;
  queueTitle: string;
  queue: QueueItem[];
  noResultSearches: NoResultSearch[] | null;
  recentActivity: ActivityItem[] | null;
  atRisk: AtRiskLearner[] | null;
};

export type LabelCount = { label: string; count: number };
export type LearnersMetrics = { stats: Stat[]; funnel: LabelCount[]; weekly: Series | null };

export type PathRow = {
  id: string;
  title: string;
  lessons: number;
  started: number;
  /** 0-100 */
  completionRate: number;
  avgMinutes: number | null;
  dropLesson: number | null;
  /** Share of learners who stop at dropLesson, 0-100. */
  dropPct: number | null;
};
export type PathsMetrics = { rows: PathRow[] };

export type LessonStep = { number: number; title: string; count: number };
export type PathDetail = {
  id: string;
  title: string;
  lessons: number;
  level: string;
  stats: Stat[];
  steps: LessonStep[];
  biggestDrop: { lesson: number; pct: number; note: string | null } | null;
};

export type TopItem = { id: string; title: string; count: number };
export type NoResultRow = { term: string; count: number; lastAt: string | null };
export type LibraryMetrics = {
  mostOpened: TopItem[];
  mostSaved: TopItem[];
  noResults: NoResultRow[];
};

export type EmailRow = {
  template: string;
  sent: number;
  openedRate: number | null;
  clickedRate: number | null;
  result: string | null;
};
export type EmailsMetrics = { stats: Stat[]; rows: EmailRow[] };

export type SupportMetrics = { stats: Stat[]; byTopic: LabelCount[]; problems: LabelCount[] };
