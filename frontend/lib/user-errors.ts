/** Public copy for API failures. Server text is never rendered in the browser. */
export function publicApiErrorMessage(status: number, code: string): string {
  if (code === "published_response_too_large") {
    return "API response exceeded the size limit. Request fewer records or use pagination.";
  }
  if (code === "published_response_invalid") {
    return "The generated API returned invalid JSON. Check its response format.";
  }
  if (code === "admin_verification_required") {
    return "Admin access is locked. Sign in again with your authenticator or passkey.";
  }
  if (code === "rate_limited" || status === 429) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (code === "account_suspended") {
    return "This account is unavailable. Contact support if you need help.";
  }
  if (code === "usage_limit_reached") {
    return "You've reached the current limit. Please try again later.";
  }
  if (status === 401) return "Please sign in again or check your details.";
  if (status === 403) return "You don't have access to this action.";
  if (status === 404) return "We couldn't find what you requested.";
  if (status === 413) return "That request is too large. Try a smaller one.";
  if (status === 400 || status === 409 || status === 422) {
    return "We couldn't complete that request. Check your details and try again.";
  }
  if (status >= 500) return "Something went wrong on our side. Please try again shortly.";
  return "Something went wrong. Please try again.";
}

/** Browsers use NotAllowedError for both a cancelled passkey prompt and a timeout. */
export function passkeyWasNotCompleted(error: unknown): boolean {
  return error instanceof Error &&
    (error.name === "NotAllowedError" || error.name === "AbortError");
}

export const PASSKEY_NOT_COMPLETED =
  "Passkey check wasn't completed. You can try again or use another sign-in method.";
