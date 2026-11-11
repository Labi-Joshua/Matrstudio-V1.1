/** Calls for the dashboard and metrics screens (spec D). Paths are relative to /api/admin. */
import { type ApiResult, adminRequest, ignoreBody, networkFailure, normaliseFailure } from "../api";
import {
  parseDashboard,
  parseEmails,
  parseLearners,
  parseLibrary,
  parsePathDetail,
  parsePaths,
  parseSupport,
} from "./parse";
import { type DashRange, rangeQuery } from "./range";

export const METRIC_TABS = ["learners", "paths", "library", "emails", "support"] as const;
export type MetricTab = (typeof METRIC_TABS)[number];

export const TAB_LABEL: Record<MetricTab, string> = {
  learners: "Learners",
  paths: "Paths",
  library: "Library",
  emails: "Emails",
  support: "Support",
};

export const getDashboard = (range: DashRange, signal?: AbortSignal) =>
  adminRequest("GET", `/dashboard?${rangeQuery(range)}`, parseDashboard, { signal });

export const getLearners = (range: DashRange, signal?: AbortSignal) =>
  adminRequest("GET", `/metrics/learners?${rangeQuery(range)}`, parseLearners, { signal });

export const getPaths = (range: DashRange, signal?: AbortSignal) =>
  adminRequest("GET", `/metrics/paths?${rangeQuery(range)}`, parsePaths, { signal });

export const getPathDetail = (id: string, range: DashRange, signal?: AbortSignal) =>
  adminRequest(
    "GET",
    `/metrics/paths/${encodeURIComponent(id)}?${rangeQuery(range)}`,
    parsePathDetail,
    {
      signal,
    },
  );

export const getLibrary = (range: DashRange, signal?: AbortSignal) =>
  adminRequest("GET", `/metrics/library?${rangeQuery(range)}`, parseLibrary, { signal });

export const getEmails = (range: DashRange, signal?: AbortSignal) =>
  adminRequest("GET", `/metrics/emails?${rangeQuery(range)}`, parseEmails, { signal });

export const getSupport = (range: DashRange, signal?: AbortSignal) =>
  adminRequest("GET", `/metrics/support?${rangeQuery(range)}`, parseSupport, { signal });

/** Hides a no-result search term from the list (POST /metrics/library/dismiss-search). */
export const dismissSearchTerm = (term: string) =>
  adminRequest("POST", "/metrics/library/dismiss-search", ignoreBody, { body: { term } });

export type CsvFile = { filename: string; blob: Blob };

/** GET /metrics/:tab/export: the CSV body, with the server's file name when it sends one. */
export async function exportMetrics(tab: MetricTab, range: DashRange): Promise<ApiResult<CsvFile>> {
  let response: Response;
  try {
    response = await fetch(`/api/admin/metrics/${tab}/export?${rangeQuery(range)}`, {
      credentials: "include",
      cache: "no-store",
      headers: { accept: "text/csv" },
    });
  } catch {
    return networkFailure();
  }
  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    return normaliseFailure(response.status, body, response.headers.get("retry-after"));
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const named = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  const stamp = new Date().toISOString().slice(0, 10);
  return { ok: true, data: { filename: named ?? `matr-${tab}-${stamp}.csv`, blob } };
}

/** Hands a blob to the browser as a download. */
export function saveBlob({ filename, blob }: CsvFile): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
