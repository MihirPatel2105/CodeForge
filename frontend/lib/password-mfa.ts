export type PasswordMfaMethod = "totp" | "passkey";

export interface PendingPasswordMfa {
  ticket: string;
  email: string;
  methods: PasswordMfaMethod[];
  startedAt: number;
}

const STORAGE_KEY = "codeforge_password_mfa";
const TICKET_LIFETIME_MS = 5 * 60 * 1000;

export function savePendingPasswordMfa(value: Omit<PendingPasswordMfa, "startedAt">): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...value, startedAt: Date.now() }));
}

export function loadPendingPasswordMfa(): PendingPasswordMfa | null {
  const saved = sessionStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  try {
    const value: unknown = JSON.parse(saved);
    if (
      !value || typeof value !== "object" ||
      !("ticket" in value) || typeof value.ticket !== "string" || !value.ticket ||
      !("email" in value) || typeof value.email !== "string" ||
      !("startedAt" in value) || typeof value.startedAt !== "number" ||
      !("methods" in value) || !Array.isArray(value.methods) ||
      value.methods.length === 0 ||
      !value.methods.every((method) => method === "totp" || method === "passkey") ||
      Date.now() - value.startedAt >= TICKET_LIFETIME_MS ||
      value.startedAt > Date.now()
    ) {
      clearPendingPasswordMfa();
      return null;
    }
    return value as PendingPasswordMfa;
  } catch {
    clearPendingPasswordMfa();
    return null;
  }
}

export function clearPendingPasswordMfa(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
