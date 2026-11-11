import { isRecord } from "../api";
import {
  type CuratedPath,
  type CuratedResource,
  type EmailTemplate,
  type HomeCuration,
  type NudgeRules,
  type PopularRules,
  type QueueTargets,
  TAXONOMY_KINDS,
  type TaxonomyItem,
  type TaxonomyUsage,
  WEEKDAYS,
  type Weekday,
} from "./types";

/** Tolerant parsers: each returns undefined when the body is not the expected shape. */

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);

/** The list inside { items: [...] }, { <key>: [...] } or a bare array. */
function listOf(json: unknown, key?: string): unknown[] | undefined {
  if (Array.isArray(json)) return json;
  if (!isRecord(json)) return undefined;
  const inner = json.items ?? (key ? json[key] : undefined);
  return Array.isArray(inner) ? inner : undefined;
}

function many<T>(list: unknown[] | undefined, one: (v: unknown) => T | undefined) {
  if (!list) return undefined;
  const out: T[] = [];
  for (const entry of list) {
    const parsed = one(entry);
    if (parsed === undefined) return undefined;
    out.push(parsed);
  }
  return out;
}

export function parseTaxonomyItem(json: unknown): TaxonomyItem | undefined {
  const item = isRecord(json) && isRecord(json.item) ? json.item : json;
  if (!isRecord(item)) return undefined;
  const id = str(item.id);
  const name = str(item.name);
  const kind = TAXONOMY_KINDS.find((k) => k === item.kind);
  if (!id || name === undefined || !kind) return undefined;
  const counts = isRecord(item.counts) ? item.counts : item;
  return { id, kind, name, resources: num(counts.resources) ?? 0, paths: num(counts.paths) ?? 0 };
}

export const parseTaxonomy = (json: unknown) => many(listOf(json, "taxonomy"), parseTaxonomyItem);

export function parseUsage(json: unknown): TaxonomyUsage | undefined {
  if (!isRecord(json)) return undefined;
  const counts = isRecord(json.counts) ? json.counts : json;
  const resources = num(counts.resources);
  const paths = num(counts.paths);
  return resources === undefined || paths === undefined ? undefined : { resources, paths };
}

export function parsePath(json: unknown): CuratedPath | undefined {
  if (!isRecord(json)) return undefined;
  const id = str(json.id);
  const title = str(json.title);
  if (!id || title === undefined) return undefined;
  return {
    id,
    title,
    level: str(json.level) ?? "",
    learners: num(json.learners) ?? num(json.learnerCount) ?? null,
  };
}

export function parseResource(json: unknown): CuratedResource | undefined {
  if (!isRecord(json)) return undefined;
  const id = str(json.id);
  const title = str(json.title);
  if (!id || title === undefined) return undefined;
  return {
    id,
    title,
    kind: str(json.kind) ?? str(json.type) ?? "",
    minutes: num(json.minutes) ?? num(json.durationMinutes) ?? null,
  };
}

export const parsePathList = (json: unknown) => many(listOf(json, "paths"), parsePath);
export const parseResourceList = (json: unknown) => many(listOf(json, "resources"), parseResource);

export const DEFAULT_RULES: PopularRules = {
  rankBy: "saves_completions",
  window: "30d",
  hideReported: true,
  minLearners: 20,
};

function parseRules(json: unknown): PopularRules | undefined {
  if (json === undefined || json === null) return { ...DEFAULT_RULES };
  if (!isRecord(json)) return undefined;
  const min = json.minLearners;
  return {
    rankBy: str(json.rankBy) ?? DEFAULT_RULES.rankBy,
    window: str(json.window) ?? DEFAULT_RULES.window,
    hideReported: bool(json.hideReported) ?? DEFAULT_RULES.hideReported,
    minLearners: min === null ? null : (num(min) ?? DEFAULT_RULES.minLearners),
  };
}

export function parseHomeCuration(json: unknown): HomeCuration | undefined {
  if (!isRecord(json)) return undefined;
  const featuredPaths = many(listOf(json.featuredPaths ?? [], "paths"), parsePath);
  const libraryPicks = many(listOf(json.libraryPicks ?? [], "resources"), parseResource);
  const popular = parseRules(json.popularRules ?? json.popular);
  if (!featuredPaths || !libraryPicks || !popular) return undefined;
  return { featuredPaths, libraryPicks, popular };
}

export function parseTemplate(json: unknown): EmailTemplate | undefined {
  const src = isRecord(json) && isRecord(json.template) ? json.template : json;
  if (!isRecord(src)) return undefined;
  const key = str(src.key);
  const subject = str(src.subject);
  const body = str(src.body);
  if (!key || subject === undefined || body === undefined) return undefined;
  const vars = Array.isArray(src.variables)
    ? src.variables.filter((v): v is string => typeof v === "string")
    : [];
  return {
    key,
    name: str(src.name) ?? key,
    when: str(src.when) ?? str(src.description) ?? "",
    subject,
    body,
    variables: vars.map((v) => v.replace(/^\{|\}$/g, "")),
    cta: str(src.cta) ?? null,
  };
}

export const parseTemplates = (json: unknown) => many(listOf(json, "templates"), parseTemplate);

export function parseNudgeRules(json: unknown): NudgeRules | undefined {
  if (!isRecord(json)) return undefined;
  const src = isRecord(json.rules) ? json.rules : json;
  const enabled = bool(src.enabled);
  const first = num(src.firstAfterDays);
  const second = num(src.secondAfterDays);
  const max = num(src.maxPerWeek);
  if (enabled === undefined || first === undefined || second === undefined || max === undefined)
    return undefined;
  return { enabled, firstAfterDays: first, secondAfterDays: second, maxPerWeek: max };
}

export function parseQueueTargets(json: unknown): QueueTargets | undefined {
  if (!isRecord(json)) return undefined;
  const src = isRecord(json.targets) ? json.targets : json;
  const days = Array.isArray(src.workingDays) ? src.workingDays : undefined;
  const submissionDays = num(src.submissionDays);
  const linkReportDays = num(src.linkReportDays);
  const firstReplyDays = num(src.firstReplyDays);
  const autoResolveDays = num(src.autoResolveDays);
  if (
    !days ||
    submissionDays === undefined ||
    linkReportDays === undefined ||
    firstReplyDays === undefined ||
    autoResolveDays === undefined
  )
    return undefined;
  const workingDays: Weekday[] = WEEKDAYS.filter((d) => days.includes(d));
  return { submissionDays, linkReportDays, firstReplyDays, autoResolveDays, workingDays };
}
