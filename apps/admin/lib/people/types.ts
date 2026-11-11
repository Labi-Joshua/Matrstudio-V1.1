/** Shapes the People screens expect from /api/admin (Users, Waitlist, Support). See lib/people/api.ts. */

export type UserStatus = "active" | "unconfirmed" | "suspended";
export type UserFilter = "all" | UserStatus;

export type UserRow = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  joinedAt: string;
  lastSignInAt: string | null;
  pathsCount: number;
};

export type UserList = {
  users: UserRow[];
  nextCursor: string | null;
  totals: { learners: number | null; waitlist: number | null };
};

export type PathProgress = {
  id: string;
  title: string;
  state: "in_progress" | "completed" | "saved";
  lessonsDone: number;
  lessonsTotal: number;
  percent: number;
  finishedAt: string | null;
};

export type UserSubmission = {
  id: string;
  title: string;
  status: "approved" | "in_review" | "declined" | "needs_changes";
  at: string | null;
};

export type UserTicket = {
  id: string;
  subject: string;
  kind: "support" | "report";
  status: string;
  at: string | null;
};

export type UserDetail = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  joinedAt: string;
  emailConfirmedAt: string | null;
  authMethod: "password" | "google" | "both";
  lastSignInAt: string | null;
  suspension: { at: string; by: string; reason: string } | null;
  profileHidden: { at: string; reason: string; reports: number } | null;
  paths: PathProgress[];
  submissions: UserSubmission[];
  tickets: UserTicket[];
};

export type ExportResult = { queued: boolean; data: unknown | null };

export type WaitlistStatus = "waiting" | "invited" | "created" | "confirmed";
export type WaitlistFilter = "waiting" | "invited" | "joined" | "all";

export type WaitlistStats = {
  waiting: number;
  oldestWaitingAt: string | null;
  invited: number;
  lastBatchAt: string | null;
  created: number;
  confirmed: number;
};

export type WaitlistEntry = {
  id: string;
  email: string;
  joinedAt: string;
  source: string | null;
  status: WaitlistStatus;
};

export type WaitlistList = { entries: WaitlistEntry[]; nextCursor: string | null };

export type Batch = {
  id: string;
  sentAt: string;
  invited: number;
  created: number;
  confirmed: number;
  /** Invited more than 7 days ago, still not joined, and not yet reminded. */
  notJoined: number;
  reminderSentAt: string | null;
};

export type SupportTab = "open" | "waiting" | "resolved";
export type SupportKind = "support" | "report";
export type TicketStatus =
  | "open"
  | "replied"
  | "waiting_on_user"
  | "resolved"
  | "fixed"
  | "cant_reproduce";

export type TicketRow = {
  id: string;
  subject: string;
  snippet: string;
  requester: { name: string; email: string };
  kind: SupportKind;
  category: string;
  status: TicketStatus;
  isNew: boolean;
  logged: boolean;
  createdAt: string;
  dueAt: string | null;
  overdue: boolean;
  assignedToMe: boolean;
};

export type SupportList = {
  tickets: TicketRow[];
  counts: { open: number | null; waiting: number | null; resolved: number | null };
  nextCursor: string | null;
};

export type ThreadMessage = {
  id: string;
  author: "learner" | "staff" | "note";
  name: string;
  body: string;
  at: string;
  channel: string | null;
};

export type Severity = "low" | "medium" | "high";

export type TicketDetail = {
  id: string;
  subject: string;
  kind: SupportKind;
  category: string;
  status: TicketStatus;
  isNew: boolean;
  createdAt: string;
  dueAt: string | null;
  overdue: boolean;
  assignee: { id: string; name: string } | null;
  assignedToMe: boolean;
  requester: {
    id: string | null;
    name: string;
    email: string;
    joinedAt: string | null;
    paths: string | null;
    pastTotal: number;
    pastResolved: number;
  };
  messages: ThreadMessage[];
  attached: string[];
  issue: { id: number; title: string; severity: Severity } | null;
  linkReport: { id: string; title: string; reports: number } | null;
  autoResolveDays: number | null;
};
