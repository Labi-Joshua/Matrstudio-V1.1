/** Shapes of the Review queues API (spec D, /api/admin/review/*). Parsers are in api.ts. */

export type Person = { id: string; name: string };
export type Assignee = Person | null;

export type CheckStatus = "pass" | "warn" | "fail";
export type QueueKey = "submissions" | "link-reports" | "profile-reports";

export type Counts = { submissions: number; linkReports: number; profileReports: number };

export type SubmitterStats = {
  id: string;
  name: string;
  /** "March 2026" style text or an ISO date; shown as "Learner since ...". */
  since: string | null;
  submitted: number;
  approved: number;
  declined: number;
};

export type AutoCheck = { key: string; label: string; status: CheckStatus };

export type DuplicateOf = {
  id: string;
  title: string;
  url: string | null;
  /** Live, Retired... */
  status: string;
  usedInPaths: number;
};

export type SubmissionRow = {
  id: string;
  title: string;
  source: string;
  type: string;
  submitter: { id: string; name: string; submitted: number; approved: number };
  check: { status: CheckStatus; label: string };
  ageDays: number;
  assignedTo: Assignee;
};

export type LinkReportRow = {
  id: string;
  title: string;
  source: string;
  usedInPaths: number;
  reportCount: number;
  reason: string;
  linkStatus: "failed" | "redirects" | "ok";
  ageDays: number;
  assignedTo: Assignee;
};

export type ProfileReportRow = {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  reason: string;
  reportCount: number;
  ageDays: number;
  assignedTo: Assignee;
};

export type Page<T> = { items: T[]; nextCursor: string | null; counts: Counts | null };

export type SubmissionDetail = {
  id: string;
  title: string;
  url: string;
  source: string;
  type: string;
  minutes: number | null;
  topic: string | null;
  level: string | null;
  creator: string | null;
  note: string;
  ageDays: number;
  submittedAt: string | null;
  status: string;
  submitter: SubmitterStats;
  autoChecks: AutoCheck[];
  duplicateOf: DuplicateOf | null;
  assignedTo: Assignee;
};

export type Reporter = { name: string; when: string; text: string };

export type LinkReportDetail = {
  id: string;
  resourceId: string;
  title: string;
  url: string | null;
  type: string;
  reportCount: number;
  firstReportDays: number;
  linkStatus: "failed" | "redirects" | "ok";
  reports: Reporter[];
  linkCheck: { ok: boolean; reason: string; checkedText: string };
  usedIn: string[];
  learnersNow: number;
  assignedTo: Assignee;
  /** Set once somebody has fixed or dismissed it. */
  resolved: boolean;
};

export type ProfileReportDetail = {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  profileUrl: string | null;
  reason: string;
  reportCount: number;
  ageDays: number;
  bio: string;
  links: string[];
  reports: Reporter[];
  facts: { joined: string; pathsStarted: number; submissions: number; pastReports: number };
  assignedTo: Assignee;
  resolved: boolean;
};

export type ApproveBody = {
  record: {
    title: string;
    creator: string;
    type: string;
    topic: string;
    level: string;
    intro: string;
    placement: "library" | "library_and_path";
  };
  credit: boolean;
};

export type DeclineReason = "not_free" | "not_a_fit" | "low_quality" | "other" | "duplicate";
export type ReviewerMe = { id: string; name: string; canManage: boolean };
