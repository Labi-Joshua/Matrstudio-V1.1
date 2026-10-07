import type {
  ApiErrorBody,
  HealthResponse,
  PresignUploadRequest,
  PresignUploadResponse,
  WaitlistSignupRequest,
  WaitlistSignupResponse,
  WaitlistStatsResponse,
} from "@matr/types";

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export type ApiClientOptions = {
  /** e.g. "http://localhost:8787" in development, "https://api.matr.studio" in production. */
  baseUrl: string;
  /** Override for tests or server-side use. */
  fetch?: typeof fetch;
  /** Extra headers, e.g. a bearer token for the admin app. */
  headers?: () => Record<string, string>;
};

export function createApiClient(options: ApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const doFetch = options.fetch ?? fetch;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await doFetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers?.(),
        ...init.headers,
      },
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
      throw new ApiClientError(
        res.status,
        body?.error.code ?? "http_error",
        body?.error.message ?? `Request failed with ${res.status}`,
      );
    }
    return (await res.json()) as T;
  }

  return {
    health: () => request<HealthResponse>("/health"),
    waitlist: {
      join: (body: WaitlistSignupRequest) =>
        request<WaitlistSignupResponse>("/api/waitlist", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      stats: () => request<WaitlistStatsResponse>("/api/waitlist/stats"),
    },
    uploads: {
      presign: (body: PresignUploadRequest) =>
        request<PresignUploadResponse>("/api/uploads/presign", {
          method: "POST",
          body: JSON.stringify(body),
        }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
