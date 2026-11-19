/**
 * The three numbered lines on the auth horizon band, chosen by what the page is for. Keyed by the
 * label each auth page already passes to AuthEntryShell; anything unlisted falls back by `proof`.
 * Every line must stay true to the flow it describes (reset links last
 * `reset_token_ttl_minutes` = 10, a reset signs the user straight in, sign-in verification offers
 * an authenticator code or a passkey).
 */
export type AuthProof = "product" | "recovery" | "security";

const SIGN_IN = ["Pick up your projects where you left them", "Answer the approvals waiting on you", "Use, try or publish the APIs you built"];
const PASSWORD_RESET = ["Enter the email on your account", "Open the one-time link we send", "Choose a new password"];
const TWO_FACTOR_RECOVERY = ["Contact our team about your authenticator", "Request a recovery review by email", "Set up a new authenticator"];
const SIGN_IN_ALERT = ["Check the new sign-in", "If it wasn't you, secure your account", "If it was, nothing else to do"];

const STEPS_BY_LABEL: Record<string, readonly string[]> = {
  "Sign in": SIGN_IN,
  "Create account": ["Describe the API you need", "Approve the plan", "Watch it built, reviewed and tested"],
  "Verify your email": ["Open the email we just sent", "Enter the 6-digit code", "Start your first build"],
  "Passkey sign in": ["Choose the passkey saved for CodeForge", "Confirm with your device PIN or biometrics", "Go straight to your projects"],
  "Verify sign in": ["Your password is confirmed", "Enter an authenticator code or use a passkey", "Go straight to your projects"],
  "Request a password reset": PASSWORD_RESET,
  "Reset link requested": ["Check your inbox and spam folder", "Open the link within 10 minutes", "Choose a new password"],
  "Set a new password": ["Choose a new password", "Meet all four password rules", "Get signed straight back in"],
  "Recovery support": TWO_FACTOR_RECOVERY,
  "Recover two-factor access": TWO_FACTOR_RECOVERY,
  "Request recovery review": TWO_FACTOR_RECOVERY,
  "Review sign-in alert": SIGN_IN_ALERT,
};

const STEPS_BY_PROOF: Record<AuthProof, readonly string[]> = {
  product: SIGN_IN,
  recovery: PASSWORD_RESET,
  security: SIGN_IN_ALERT,
};

export function stepsFor(label: string, proof: AuthProof): readonly string[] {
  return STEPS_BY_LABEL[label] ?? STEPS_BY_PROOF[proof];
}
