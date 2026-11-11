/** Tolerant parsers: a wrong shape gives undefined (the client reports invalid_response). */
import { isRecord } from "../api";
import type {
  ActivityItem,
  AtRiskLearner,
  AttentionItem,
  Dashboard,
  EmailRow,
  EmailsMetrics,
  LabelCount,
  LearnersMetrics,
  LibraryMetrics,
  NoResultRow,
  NoResultSearch,
  PathDetail,
  PathRow,
  PathsMetrics,
  QueueItem,
  QueueKind,
  Series,
  Stat,
  SupportMetrics,
  TopItem,
} from "./types";

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const numOrNull = (v: unknown): number | null => num(v) ?? null;
const strOrNull = (v: unknown): string | null => str(v) ?? null;

/** Maps every item; undefined (whole list rejected) if any item is malformed. */
function list<T>(value: unknown, item: (v: unknown) => T | undefined): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: T[] = [];
  for (const v of value) {
    const parsed = item(v);
    if (parsed === undefined) return undefined;
    out.push(parsed);
  }
  return out;
}

/** An optional list: absent or null is null; a malformed list is undefined. */
function optionalList<T>(
  value: unknown,
  item: (v: unknown) => T | undefined,
): T[] | null | undefined {
  return value === undefined || value === null ? null : list(value, item);
}

export function parseStat(v: unknown): Stat | undefined {
  if (!isRecord(v)) return undefined;
  const key = str(v.key);
  const label = str(v.label);
  const value = num(v.value);
  if (key === undefined || label === undefined || value === undefined) return undefined;
  const unit = v.unit === "percent" || v.unit === "minutes" ? v.unit : "count";
  const better = v.better === "down" || v.better === "neutral" ? v.better : "up";
  const compare = v.compare === "absolute" ? "absolute" : "relative";
  return { key, label, value, previous: numOrNull(v.previous), unit, better, compare };
}

function parseSeries(v: unknown): Series | null | undefined {
  if (v === undefined || v === null) return null;
  if (!isRecord(v)) return undefined;
  const labels = list(v.labels, str);
  const current = list(v.current, (n) => (n === null ? null : num(n)));
  const previous = list(v.previous, (n) => (n === null ? null : num(n)));
  const title = str(v.title);
  if (!labels || !current || !previous || title === undefined) return undefined;
  if (current.length !== labels.length || previous.length !== labels.length) return undefined;
  return { title, labels, current, previous };
}

const QUEUE_KINDS: QueueKind[] = ["submission", "broken_link", "help_request", "profile_report"];

function parseQueueItem(v: unknown): QueueItem | undefined {
  if (!isRecord(v)) return undefined;
  const id = str(v.id);
  const title = str(v.title);
  const meta = str(v.meta);
  const href = str(v.href);
  const kind = QUEUE_KINDS.find((k) => k === v.kind);
  if (!id || title === undefined || meta === undefined || !href || !kind) return undefined;
  return { id, kind, title, meta, overTarget: v.overTarget === true, href };
}

function parseAttention(v: unknown): AttentionItem | undefined {
  if (!isRecord(v)) return undefined;
  const id = str(v.id);
  const text = str(v.text);
  const linkLabel = str(v.linkLabel);
  const href = str(v.href);
  return id && text && linkLabel && href ? { id, text, linkLabel, href } : undefined;
}

function parseNoResult(v: unknown): NoResultSearch | undefined {
  if (!isRecord(v)) return undefined;
  const term = str(v.term);
  const count = num(v.count);
  if (term === undefined || count === undefined) return undefined;
  return { term, count, periodLabel: str(v.periodLabel) ?? "searches" };
}

function parseActivity(v: unknown): ActivityItem | undefined {
  if (!isRecord(v)) return undefined;
  const id = str(v.id);
  const actor = str(v.actor);
  const action = str(v.action);
  const at = str(v.at);
  if (!id || actor === undefined || action === undefined || at === undefined) return undefined;
  return { id, actor, action, detail: str(v.detail) ?? "", at, href: strOrNull(v.href) };
}

function parseAtRisk(v: unknown): AtRiskLearner | undefined {
  if (!isRecord(v)) return undefined;
  const id = str(v.id);
  const email = str(v.email);
  const reason = str(v.reason);
  const href = str(v.href);
  return id && email && reason !== undefined && href ? { id, email, reason, href } : undefined;
}

export function parseDashboard(json: unknown): Dashboard | undefined {
  if (!isRecord(json)) return undefined;
  const variant = json.variant === "curator" || json.variant === "support" ? json.variant : "admin";
  const attention = list(json.attention ?? [], parseAttention);
  const stats = list(json.stats, parseStat);
  const series = parseSeries(json.series);
  const queue = list(json.queue ?? [], parseQueueItem);
  const noResults = optionalList(json.noResultSearches, parseNoResult);
  const activity = optionalList(json.recentActivity, parseActivity);
  const atRisk = optionalList(json.atRisk, parseAtRisk);
  if (!attention || !stats || series === undefined || !queue) return undefined;
  if (noResults === undefined || activity === undefined || atRisk === undefined) return undefined;
  const defaultTitle =
    variant === "curator" ? "Your queue" : variant === "support" ? "Help requests" : "Queues";
  return {
    variant,
    firstName: strOrNull(json.firstName),
    headline: strOrNull(json.headline),
    firstTime: json.firstTime === true,
    attention,
    stats,
    series,
    queueTitle: str(json.queueTitle) ?? defaultTitle,
    queue,
    noResultSearches: noResults,
    recentActivity: activity,
    atRisk,
  };
}

const labelCount = (v: unknown): LabelCount | undefined => {
  if (!isRecord(v)) return undefined;
  const label = str(v.label);
  const count = num(v.count);
  return label !== undefined && count !== undefined ? { label, count } : undefined;
};

export function parseLearners(json: unknown): LearnersMetrics | undefined {
  if (!isRecord(json)) return undefined;
  const stats = list(json.stats, parseStat);
  const funnel = list(json.funnel, labelCount);
  const weekly = parseSeries(json.weekly);
  if (!stats || !funnel || weekly === undefined) return undefined;
  return { stats, funnel, weekly };
}

function parsePathRow(v: unknown): PathRow | undefined {
  if (!isRecord(v)) return undefined;
  const id = str(v.id);
  const title = str(v.title);
  const lessons = num(v.lessons);
  const started = num(v.started);
  const completionRate = num(v.completionRate);
  if (!id || title === undefined || lessons === undefined) return undefined;
  if (started === undefined || completionRate === undefined) return undefined;
  return {
    id,
    title,
    lessons,
    started,
    completionRate,
    avgMinutes: numOrNull(v.avgMinutes),
    dropLesson: numOrNull(v.dropLesson),
    dropPct: numOrNull(v.dropPct),
  };
}

export function parsePaths(json: unknown): PathsMetrics | undefined {
  if (!isRecord(json)) return undefined;
  const rows = list(json.rows, parsePathRow);
  return rows ? { rows } : undefined;
}

export function parsePathDetail(json: unknown): PathDetail | undefined {
  if (!isRecord(json)) return undefined;
  const id = str(json.id);
  const title = str(json.title);
  const lessons = num(json.lessons);
  const stats = list(json.stats, parseStat);
  const steps = list(json.steps, (s) => {
    if (!isRecord(s)) return undefined;
    const number = num(s.number);
    const count = num(s.count);
    return number !== undefined && count !== undefined
      ? { number, title: str(s.title) ?? "", count }
      : undefined;
  });
  if (!id || title === undefined || lessons === undefined || !stats || !steps) return undefined;
  const d = json.biggestDrop;
  let biggestDrop: PathDetail["biggestDrop"] = null;
  if (isRecord(d)) {
    const lesson = num(d.lesson);
    const pct = num(d.pct);
    if (lesson === undefined || pct === undefined) return undefined;
    biggestDrop = { lesson, pct, note: strOrNull(d.note) };
  }
  return { id, title, lessons, level: str(json.level) ?? "", stats, steps, biggestDrop };
}

const topItem = (v: unknown): TopItem | undefined => {
  if (!isRecord(v)) return undefined;
  const id = str(v.id);
  const title = str(v.title);
  const count = num(v.count);
  return id && title !== undefined && count !== undefined ? { id, title, count } : undefined;
};

const noResultRow = (v: unknown): NoResultRow | undefined => {
  if (!isRecord(v)) return undefined;
  const term = str(v.term);
  const count = num(v.count);
  return term !== undefined && count !== undefined
    ? { term, count, lastAt: strOrNull(v.lastAt) }
    : undefined;
};

export function parseLibrary(json: unknown): LibraryMetrics | undefined {
  if (!isRecord(json)) return undefined;
  const mostOpened = list(json.mostOpened, topItem);
  const mostSaved = list(json.mostSaved, topItem);
  const noResults = list(json.noResults, noResultRow);
  return mostOpened && mostSaved && noResults ? { mostOpened, mostSaved, noResults } : undefined;
}

const emailRow = (v: unknown): EmailRow | undefined => {
  if (!isRecord(v)) return undefined;
  const template = str(v.template);
  const sent = num(v.sent);
  if (template === undefined || sent === undefined) return undefined;
  return {
    template,
    sent,
    openedRate: numOrNull(v.openedRate),
    clickedRate: numOrNull(v.clickedRate),
    result: strOrNull(v.result),
  };
};

export function parseEmails(json: unknown): EmailsMetrics | undefined {
  if (!isRecord(json)) return undefined;
  const stats = list(json.stats, parseStat);
  const rows = list(json.rows, emailRow);
  return stats && rows ? { stats, rows } : undefined;
}

export function parseSupport(json: unknown): SupportMetrics | undefined {
  if (!isRecord(json)) return undefined;
  const stats = list(json.stats, parseStat);
  const byTopic = list(json.byTopic, labelCount);
  const problems = list(json.problems, labelCount);
  return stats && byTopic && problems ? { stats, byTopic, problems } : undefined;
}
