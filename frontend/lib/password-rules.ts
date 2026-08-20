/**
 * The password rules, mirrored from `PASSWORD_RULES` in `backend/app/schemas/api.py`.
 *
 * The backend is the authority — it rejects a registration that breaks any of these.
 * These exist so the form can tick them off as the user types rather than making them
 * guess, and the wording is kept identical to the server's so a rule can never be
 * advertised here in different words than it is enforced there.
 *
 * The minimum is 8, not the 6 in the reference design: relaxing an existing control to
 * match a mockup would be a step backwards.
 */

export interface PasswordRule {
  id: string;
  label: string;
  test: (value: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "At least 8 characters", test: (v) => v.length >= 8 },
  { id: "uppercase", label: "One uppercase letter (A-Z)", test: (v) => /[A-Z]/.test(v) },
  { id: "lowercase", label: "One lowercase letter (a-z)", test: (v) => /[a-z]/.test(v) },
  { id: "number", label: "One number (0-9)", test: (v) => /[0-9]/.test(v) },
];

export function passwordMeetsAllRules(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}
