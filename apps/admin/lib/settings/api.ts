import { type ApiResult, adminRequest, ignoreBody, isRecord } from "../api";
import {
  parseHomeCuration,
  parseNudgeRules,
  parsePathList,
  parseQueueTargets,
  parseResourceList,
  parseTaxonomy,
  parseTaxonomyItem,
  parseTemplate,
  parseTemplates,
  parseUsage,
} from "./parse";
import type {
  CuratedPath,
  CuratedResource,
  EmailTemplate,
  HomeCuration,
  HomeCurationInput,
  NudgeRules,
  QueueTargets,
  TaxonomyKind,
  TaxonomyUsage,
} from "./types";

type Signal = { signal?: AbortSignal };
const enc = encodeURIComponent;

/** The signed-in admin's permission levels, for tab visibility (GET /me). */
export type SettingsAccess = { settings: string; resources: string; email: string; name: string };
export function parseAccess(json: unknown): SettingsAccess | undefined {
  if (!isRecord(json) || !isRecord(json.permissions)) return undefined;
  const p = json.permissions;
  return {
    settings: typeof p.settings === "string" ? p.settings : "none",
    resources: typeof p.resources === "string" ? p.resources : "none",
    email: typeof json.email === "string" ? json.email : "",
    name: typeof json.name === "string" ? json.name : "",
  };
}
export const getAccess = (o: Signal = {}) => adminRequest("GET", "/me", parseAccess, o);

export const listTaxonomy = (o: Signal = {}) =>
  adminRequest("GET", "/settings/taxonomy", parseTaxonomy, o);
export const createTaxonomy = (body: { name: string; kind: TaxonomyKind }) =>
  adminRequest("POST", "/settings/taxonomy", parseTaxonomyItem, { body });
export const renameTaxonomy = (id: string, name: string) =>
  adminRequest("PATCH", `/settings/taxonomy/${enc(id)}`, parseTaxonomyItem, { body: { name } });
export const taxonomyUsage = (id: string, o: Signal = {}): Promise<ApiResult<TaxonomyUsage>> =>
  adminRequest("GET", `/settings/taxonomy/${enc(id)}/usage`, parseUsage, o);
export const mergeTaxonomy = (id: string, into: string) =>
  adminRequest("POST", `/settings/taxonomy/${enc(id)}/merge`, ignoreBody, { body: { into } });
/** `into` set = move items to that entry; omitted = just remove the tag from items. */
export const deleteTaxonomy = (id: string, into?: string) =>
  adminRequest("DELETE", `/settings/taxonomy/${enc(id)}`, ignoreBody, {
    body: into ? { mode: "move", into } : { mode: "remove" },
  });

export const getHomeCuration = (o: Signal = {}) =>
  adminRequest("GET", "/settings/home-curation", parseHomeCuration, o);
export const putHomeCuration = (body: HomeCurationInput): Promise<ApiResult<HomeCuration>> =>
  adminRequest("PUT", "/settings/home-curation", parseHomeCuration, { body });
export const listPublishedPaths = (o: Signal = {}): Promise<ApiResult<CuratedPath[]>> =>
  adminRequest("GET", "/paths?status=published", parsePathList, o);
export const listPublishedResources = (o: Signal = {}): Promise<ApiResult<CuratedResource[]>> =>
  adminRequest("GET", "/resources?status=published", parseResourceList, o);

export const listTemplates = (o: Signal = {}) =>
  adminRequest("GET", "/settings/email-templates", parseTemplates, o);
export const saveTemplate = (
  key: string,
  body: { subject: string; body: string },
): Promise<ApiResult<EmailTemplate>> =>
  adminRequest("PUT", `/settings/email-templates/${enc(key)}`, parseTemplate, { body });
export const sendTestEmail = (key: string, body: { subject: string; body: string }) =>
  adminRequest("POST", `/settings/email-templates/${enc(key)}/test`, ignoreBody, { body });

export const getNudgeRules = (o: Signal = {}) =>
  adminRequest("GET", "/settings/nudge-rules", parseNudgeRules, o);
export const putNudgeRules = (body: NudgeRules): Promise<ApiResult<NudgeRules>> =>
  adminRequest("PUT", "/settings/nudge-rules", parseNudgeRules, { body });

export const getQueueTargets = (o: Signal = {}) =>
  adminRequest("GET", "/settings/queue-targets", parseQueueTargets, o);
export const putQueueTargets = (body: QueueTargets): Promise<ApiResult<QueueTargets>> =>
  adminRequest("PUT", "/settings/queue-targets", parseQueueTargets, { body });
