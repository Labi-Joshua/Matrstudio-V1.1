import type { ApiErrorBody } from "@matr/types";

export const apiError = (code: string, message: string): ApiErrorBody => ({
  ok: false,
  error: { code, message },
});
