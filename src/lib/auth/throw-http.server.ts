import { setResponseStatus } from "@tanstack/react-start/server";

/**
 * TanStack Start's server-functions-handler serializes thrown Errors with
 * `status: getResponse().status ?? 500` and does **not** read `error.status`
 * from UnauthorizedError / ForbiddenError / CrossSiteRequestError.
 *
 * Use `throwHttpError` instead of a bare `throw` so the HTTP response is
 * 401/403 rather than an unhandled 500. Who may mutate is unchanged — only
 * status shaping.
 */
export function applyHttpErrorStatus(
  status: number,
  setStatus: (code: number) => void = setResponseStatus,
): void {
  setStatus(status);
}

/** Set the response status from `error.status`, then throw. */
export function throwHttpError(
  error: Error & { readonly status: number },
  setStatus: (code: number) => void = setResponseStatus,
): never {
  applyHttpErrorStatus(error.status, setStatus);
  throw error;
}
