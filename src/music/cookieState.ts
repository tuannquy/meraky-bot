let rejected = false;

/** Set once YouTube refuses the configured cookie, so every component stops sending it. */
export function markCookiesRejected() {
  rejected = true;
}

export function cookiesRejected() {
  return rejected;
}

export function isCookieRejectedError(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 3) return false;
  const { code, message, cause } = error as { code?: unknown; message?: unknown; cause?: unknown };
  if (code === "AUTH_FAILED") return true;
  if (typeof message === "string" && /cookie.*signed out|signed out.*cookie/i.test(message)) return true;
  return isCookieRejectedError(cause, depth + 1);
}
