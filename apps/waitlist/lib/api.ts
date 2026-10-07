import { createApiClient } from "@matr/api-client";

// Inlined at build time by Next.js. Dev: http://localhost:8787, prod: https://api.matr.studio
export const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787",
});
