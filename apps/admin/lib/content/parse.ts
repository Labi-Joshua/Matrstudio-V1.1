import { isRecord } from "../api";
import type {
  Lesson,
  Level,
  LinkCheck,
  LinkPreview,
  Module,
  PathDoc,
  PathList,
  PathRow,
  PathStatus,
  PublishCheck,
  RemovalImpact,
  ResourceCounts,
  ResourceDetail,
  ResourceList,
  ResourceRow,
  ResourceStatus,
  ResourceType,
  ResourceUsage,
} from "./types";

const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const bool = (v: unknown, d = false): boolean => (typeof v === "boolean" ? v : d);
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : d;

const TYPES = ["video", "article", "tool", "course", "template", "book"] as const;
const LEVELS = ["beginner", "intermediate", "advanced", "all"] as const;
const RSTATUS = ["draft", "live", "retired", "needs_fix"] as const;
const PSTATUS = ["draft", "live", "unpublished"] as const;

/** Parses every element with `one`; one bad element makes the whole list invalid. */
function list<T>(value: unknown, one: (v: unknown) => T | undefined): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: T[] = [];
  for (const v of value) {
    const parsed = one(v);
    if (parsed === undefined) return undefined;
    out.push(parsed);
  }
  return out;
}

export function parseResourceRow(v: unknown): ResourceRow | undefined {
  if (!isRecord(v) || typeof v.id !== "string" || typeof v.title !== "string") return undefined;
  return {
    id: v.id,
    title: v.title,
    source: str(v.source),
    creator: str(v.creator),
    type: oneOf<ResourceType>(v.type, TYPES, "video"),
    topic: str(v.topic),
    level: oneOf<Level>(v.level, LEVELS, "beginner"),
    durationMin: numOrNull(v.durationMin),
    usedInPaths: num(v.usedInPaths),
    status: oneOf<ResourceStatus>(v.status, RSTATUS, "draft"),
    problem: strOrNull(v.problem),
  };
}

function parseCounts(v: unknown): ResourceCounts {
  const r = isRecord(v) ? v : {};
  return {
    total: num(r.total),
    live: num(r.live),
    draft: num(r.draft),
    needsFix: num(r.needsFix),
    retired: num(r.retired),
    paths: num(r.paths),
  };
}

export function parseResourceList(json: unknown): ResourceList | undefined {
  if (!isRecord(json)) return undefined;
  const items = list(json.items, parseResourceRow);
  if (!items) return undefined;
  return { items, nextCursor: strOrNull(json.nextCursor), counts: parseCounts(json.counts) };
}

function parseUsage(v: unknown): ResourceUsage | undefined {
  if (!isRecord(v) || typeof v.pathId !== "string") return undefined;
  return {
    pathId: v.pathId,
    pathTitle: str(v.pathTitle),
    pathStatus: str(v.pathStatus, "live"),
    moduleTitle: str(v.moduleTitle),
    lessonNumber: num(v.lessonNumber),
    moduleNumber: num(v.moduleNumber),
  };
}

function parseLinkCheck(v: unknown): LinkCheck {
  const r = isRecord(v) ? v : {};
  return {
    at: strOrNull(r.at),
    ok: bool(r.ok, true),
    reason: strOrNull(r.reason),
    failures: num(r.failures),
  };
}

export function parseResourceDetail(json: unknown): ResourceDetail | undefined {
  const row = parseResourceRow(json);
  if (!row || !isRecord(json)) return undefined;
  const stats = isRecord(json.stats30d) ? json.stats30d : {};
  const usedIn = list(json.usedIn ?? [], parseUsage);
  if (!usedIn) return undefined;
  return {
    ...row,
    url: str(json.url),
    license: str(json.license),
    intro: str(json.intro),
    learningGoal: str(json.learningGoal),
    tags: strings(json.tags),
    thumbnail: strOrNull(json.thumbnail),
    addedBy: str(json.addedBy),
    addedAt: strOrNull(json.addedAt),
    stats30d: {
      opened: num(stats.opened),
      saved: num(stats.saved),
      done: num(stats.done),
      brokenReports: num(stats.brokenReports),
    },
    linkCheck: parseLinkCheck(json.linkCheck),
    reporters: num(json.reporters),
    usedIn,
  };
}

export function parseLinkPreview(json: unknown): LinkPreview | undefined {
  if (!isRecord(json) || typeof json.title !== "string" || typeof json.linkOk !== "boolean")
    return undefined;
  const dup = isRecord(json.duplicateOf) ? json.duplicateOf : null;
  const sug = isRecord(json.suggested) ? json.suggested : {};
  return {
    title: json.title,
    source: str(json.source),
    creator: str(json.creator),
    durationMin: numOrNull(json.durationMin),
    thumbnail: strOrNull(json.thumbnail),
    linkOk: json.linkOk,
    linkReason: strOrNull(json.linkReason),
    duplicateOf: dup && typeof dup.id === "string" ? { id: dup.id, title: str(dup.title) } : null,
    suggested: {
      type: oneOf<ResourceType>(sug.type, TYPES, "video"),
      topic: str(sug.topic),
      level: oneOf<Level>(sug.level, LEVELS, "beginner"),
      license: str(sug.license),
    },
  };
}

export function parseId(json: unknown): { id: string } | undefined {
  return isRecord(json) && typeof json.id === "string" ? { id: json.id } : undefined;
}

function parsePathRow(v: unknown): PathRow | undefined {
  if (!isRecord(v) || typeof v.id !== "string" || typeof v.title !== "string") return undefined;
  return {
    id: v.id,
    title: v.title,
    level: oneOf<Level>(v.level, LEVELS, "beginner"),
    topic: str(v.topic),
    modules: num(v.modules),
    lessons: num(v.lessons),
    learners: numOrNull(v.learners),
    completionRate: numOrNull(v.completionRate),
    updatedAt: strOrNull(v.updatedAt),
    status: oneOf<PathStatus>(v.status, PSTATUS, "draft"),
  };
}

export function parsePathList(json: unknown): PathList | undefined {
  if (!isRecord(json)) return undefined;
  const items = list(json.items, parsePathRow);
  if (!items) return undefined;
  const c = isRecord(json.counts) ? json.counts : {};
  return {
    items,
    counts: {
      all: num(c.all, items.length),
      live: num(c.live),
      draft: num(c.draft),
      unpublished: num(c.unpublished),
    },
    learnersEnrolled: num(json.learnersEnrolled),
  };
}

function parseLesson(v: unknown): Lesson | undefined {
  if (!isRecord(v) || typeof v.id !== "string") return undefined;
  return {
    id: v.id,
    resourceId: str(v.resourceId),
    title: str(v.title),
    source: str(v.source),
    type: oneOf<ResourceType>(v.type, TYPES, "video"),
    durationMin: numOrNull(v.durationMin),
    intro: str(v.intro),
  };
}

function parseModule(v: unknown): Module | undefined {
  if (!isRecord(v) || typeof v.id !== "string") return undefined;
  const lessons = list(v.lessons ?? [], parseLesson);
  return lessons ? { id: v.id, title: str(v.title), lessons } : undefined;
}

export function parsePathDoc(json: unknown): PathDoc | undefined {
  if (!isRecord(json) || typeof json.id !== "string" || typeof json.title !== "string")
    return undefined;
  const modules = list(json.modules ?? [], parseModule);
  if (!modules) return undefined;
  return {
    id: json.id,
    title: json.title,
    description: str(json.description),
    status: oneOf<PathStatus>(json.status, PSTATUS, "draft"),
    level: oneOf<Level>(json.level, LEVELS, "beginner"),
    topic: str(json.topic),
    time: str(json.time),
    showInExplore: bool(json.showInExplore, true),
    certificate: bool(json.certificate, true),
    inviteOnly: bool(json.inviteOnly),
    coverUrl: strOrNull(json.coverUrl),
    learners: num(json.learners),
    inProgress: num(json.inProgress),
    certificatesIssued: num(json.certificatesIssued),
    lastSavedAt: strOrNull(json.lastSavedAt),
    outcomes: strings(json.outcomes),
    audience: strings(json.audience),
    modules,
  };
}

export function parsePublishCheck(json: unknown): PublishCheck | undefined {
  if (!isRecord(json)) return undefined;
  const checks = list(json.checks, (c) =>
    isRecord(c) && typeof c.label === "string"
      ? { key: str(c.key, c.label), label: c.label, ok: bool(c.ok) }
      : undefined,
  );
  return checks ? { checks, warnings: strings(json.warnings) } : undefined;
}

export function parseRemovalImpact(json: unknown): RemovalImpact | undefined {
  if (!isRecord(json)) return undefined;
  return {
    tookLesson: num(json.tookLesson),
    onLesson: num(json.onLesson),
    onPath: num(json.onPath),
    notify: num(json.notify),
  };
}

export const parseOk = (): true => true;
