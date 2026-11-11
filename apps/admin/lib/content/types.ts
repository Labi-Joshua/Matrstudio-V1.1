/**
 * Shapes the Resources and Paths screens expect from /api/admin (spec section D, becontent).
 * The parsers in parse.ts are tolerant: unknown extra fields are ignored, missing optional ones
 * get a default, a wrong shape returns undefined.
 */
export type ResourceStatus = "draft" | "live" | "retired" | "needs_fix";
export type ResourceType = "video" | "article" | "tool" | "course" | "template" | "book";
export type Level = "beginner" | "intermediate" | "advanced" | "all";

export type ResourceRow = {
  id: string;
  title: string;
  source: string;
  creator: string;
  type: ResourceType;
  topic: string;
  level: Level;
  durationMin: number | null;
  usedInPaths: number;
  status: ResourceStatus;
  /** Needs-fix rows: short reason shown under the title. */
  problem: string | null;
};

export type ResourceCounts = {
  total: number;
  live: number;
  draft: number;
  needsFix: number;
  retired: number;
  paths: number;
};

export type ResourceList = {
  items: ResourceRow[];
  nextCursor: string | null;
  counts: ResourceCounts;
};

export type ResourceUsage = {
  pathId: string;
  pathTitle: string;
  pathStatus: string;
  moduleTitle: string;
  lessonNumber: number;
  moduleNumber: number;
};

export type LinkCheck = { at: string | null; ok: boolean; reason: string | null; failures: number };

export type ResourceDetail = ResourceRow & {
  url: string;
  license: string;
  intro: string;
  learningGoal: string;
  tags: string[];
  thumbnail: string | null;
  addedBy: string;
  addedAt: string | null;
  stats30d: { opened: number; saved: number; done: number; brokenReports: number };
  linkCheck: LinkCheck;
  reporters: number;
  usedIn: ResourceUsage[];
};

export type LinkPreview = {
  title: string;
  source: string;
  creator: string;
  durationMin: number | null;
  thumbnail: string | null;
  linkOk: boolean;
  linkReason: string | null;
  duplicateOf: { id: string; title: string } | null;
  suggested: { type: ResourceType; topic: string; level: Level; license: string };
};

export type ResourceInput = {
  url: string;
  title: string;
  creator: string;
  type: ResourceType;
  topic: string;
  level: Level;
  license: string;
  rights: "free_public" | "unsure";
  durationMin: number | null;
  intro: string;
  learningGoal: string;
  tags: string[];
  status: "draft" | "live";
  paths?: { pathId: string; moduleId: string }[];
};

export type PathStatus = "draft" | "live" | "unpublished";

export type PathRow = {
  id: string;
  title: string;
  level: Level;
  topic: string;
  modules: number;
  lessons: number;
  learners: number | null;
  completionRate: number | null;
  updatedAt: string | null;
  status: PathStatus;
};

export type PathList = {
  items: PathRow[];
  counts: { all: number; live: number; draft: number; unpublished: number };
  learnersEnrolled: number;
};

export type Lesson = {
  id: string;
  resourceId: string;
  title: string;
  source: string;
  type: ResourceType;
  durationMin: number | null;
  intro: string;
};

export type Module = { id: string; title: string; lessons: Lesson[] };

export type PathDoc = {
  id: string;
  title: string;
  description: string;
  status: PathStatus;
  level: Level;
  topic: string;
  time: string;
  showInExplore: boolean;
  certificate: boolean;
  inviteOnly: boolean;
  coverUrl: string | null;
  learners: number;
  inProgress: number;
  certificatesIssued: number;
  lastSavedAt: string | null;
  outcomes: string[];
  audience: string[];
  modules: Module[];
};

export type PathPatch = Partial<
  Pick<
    PathDoc,
    | "title"
    | "description"
    | "level"
    | "topic"
    | "time"
    | "showInExplore"
    | "certificate"
    | "inviteOnly"
  >
> & { modules?: { id: string; title: string; lessonIds: string[] }[] };

export type PublishCheck = {
  checks: { key: string; label: string; ok: boolean }[];
  warnings: string[];
};

export type RemovalImpact = {
  tookLesson: number;
  onLesson: number;
  onPath: number;
  notify: number;
};
