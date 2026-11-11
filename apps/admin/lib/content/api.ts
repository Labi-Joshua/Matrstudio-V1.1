import { type ApiResult, adminRequest } from "../api";
import {
  parseId,
  parseLinkPreview,
  parseOk,
  parsePathDoc,
  parsePathList,
  parsePublishCheck,
  parseRemovalImpact,
  parseResourceDetail,
  parseResourceList,
} from "./parse";
import type {
  LinkPreview,
  PathDoc,
  PathList,
  PathPatch,
  PublishCheck,
  RemovalImpact,
  ResourceDetail,
  ResourceInput,
  ResourceList,
} from "./types";

export type ResourceQuery = {
  tab: "all" | "needs_fix";
  status?: string;
  q?: string;
  type?: string;
  topic?: string;
  level?: string;
  cursor?: string | null;
  limit?: number;
};

export function queryString(params: Record<string, string | number | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const listResources = (query: ResourceQuery, signal?: AbortSignal) =>
  adminRequest<ResourceList>("GET", `/resources${queryString({ ...query })}`, parseResourceList, {
    signal,
  });

export const getResource = (id: string, signal?: AbortSignal) =>
  adminRequest<ResourceDetail>("GET", `/resources/${encodeURIComponent(id)}`, parseResourceDetail, {
    signal,
  });

export const previewLink = (url: string, signal?: AbortSignal) =>
  adminRequest<LinkPreview>("POST", "/resources/preview", parseLinkPreview, {
    body: { url },
    signal,
  });

export const createResource = (input: ResourceInput) =>
  adminRequest("POST", "/resources", parseId, { body: input });

export const updateResource = (id: string, patch: Partial<ResourceInput>) =>
  adminRequest("PATCH", `/resources/${encodeURIComponent(id)}`, parseOk, { body: patch });

export const fixResourceLink = (id: string, url: string, notifyReporters: boolean) =>
  adminRequest("POST", `/resources/${encodeURIComponent(id)}/fix-link`, parseOk, {
    body: { url, notifyReporters },
  });

export const retireResource = (id: string, notifyOwners: boolean) =>
  adminRequest("POST", `/resources/${encodeURIComponent(id)}/retire`, parseOk, {
    body: { confirm: true, notifyOwners },
  });

export const listPaths = (status: string, signal?: AbortSignal) =>
  adminRequest<PathList>("GET", `/paths${queryString({ status })}`, parsePathList, { signal });

export const createPath = (body: {
  title: string;
  description: string;
  level: string;
  topic: string;
}) => adminRequest("POST", "/paths", parseId, { body });

export const getPath = (id: string, signal?: AbortSignal) =>
  adminRequest<PathDoc>("GET", `/paths/${encodeURIComponent(id)}`, parsePathDoc, { signal });

export const patchPath = (id: string, patch: PathPatch) =>
  adminRequest<PathDoc>("PATCH", `/paths/${encodeURIComponent(id)}`, parsePathDoc, { body: patch });

export const addLessons = (id: string, resourceIds: string[], moduleId: string) =>
  adminRequest<PathDoc>("POST", `/paths/${encodeURIComponent(id)}/lessons`, parsePathDoc, {
    body: { resourceIds, moduleId },
  });

export const saveLessonIntro = (pathId: string, lessonId: string, intro: string) =>
  adminRequest(
    "PATCH",
    `/paths/${encodeURIComponent(pathId)}/lessons/${encodeURIComponent(lessonId)}`,
    parseOk,
    { body: { intro } },
  );

export const publishCheck = (id: string) =>
  adminRequest<PublishCheck>(
    "GET",
    `/paths/${encodeURIComponent(id)}/publish-check`,
    parsePublishCheck,
  );

export const publishPath = (id: string, featureTopOfExplore: boolean) =>
  adminRequest<PathDoc>("POST", `/paths/${encodeURIComponent(id)}/publish`, parsePathDoc, {
    body: { featureTopOfExplore },
  });

export const unpublishPath = (id: string) =>
  adminRequest<PathDoc>("POST", `/paths/${encodeURIComponent(id)}/unpublish`, parsePathDoc, {
    body: {},
  });

export const removalImpact = (pathId: string, lessonId: string) =>
  adminRequest<RemovalImpact>(
    "GET",
    `/paths/${encodeURIComponent(pathId)}/lessons/${encodeURIComponent(lessonId)}/removal-impact`,
    parseRemovalImpact,
  );

export const removeLesson = (pathId: string, lessonId: string, message: string | null) =>
  adminRequest<PathDoc>(
    "DELETE",
    `/paths/${encodeURIComponent(pathId)}/lessons/${encodeURIComponent(lessonId)}`,
    parsePathDoc,
    { body: { message } },
  );

export const previewPath = (id: string, signal?: AbortSignal) =>
  adminRequest<PathDoc>("GET", `/paths/${encodeURIComponent(id)}/preview`, parsePathDoc, {
    signal,
  });

export type { ApiResult };
