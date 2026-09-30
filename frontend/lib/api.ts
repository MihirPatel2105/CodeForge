/**
 * REST client for the real backend (docs/STATE_AND_API.md). Every shape here mirrors
 * `lib/types.ts`, which mirrors the backend's Pydantic schemas — no ad-hoc `any`.
 *
 * Browser requests go through the same-origin backend proxy. It keeps the bearer JWT
 * in an HttpOnly cookie and attaches it to backend calls on the server.
 */

import type {
  PasskeyInfo,
  PasskeyOptions,
  PasskeyLoginResult,
  TokenResponse,
  LoginResponse,
  DeviceResponse,
  SignInAlertResponse,
  TotpSetupResponse,
  UserResponse,
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  VerifyEmailRequest,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  DeleteAccountRequest,
  DeleteAccountResponse,
  ProjectCreate,
  ProjectResponse,
  ProjectOverviewPage,
  ProjectRunPage,
  ProjectDeleteResponse,
  RunCreate,
  RunCreateResponse,
  RunResponse,
  PreviewCall,
  PreviewInfo,
  PreviewResult,
  DeploymentInfo,
  DeploymentCreated,
  RunSummary,
  FileTreeResponse,
  FileHistoryResponse,
  ApprovalRequest,
  ApprovalResponse,
  ArtifactListResponse,
  ContactRequest,
  ContactResponse,
  AdminOverviewResponse,
  AdminRunDetail,
  AdminRunPage,
  AdminUserDetail,
  AdminUserPage,
  AdminQualityResponse,
  AdminSystemHealthResponse,
  AdminAuditPage,
  AdminMonitoringResponse,
  AdminActionResponse,
  ErrorResponse,
} from "./types";
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON, RegistrationResponseJSON, AuthenticationResponseJSON } from "@simplewebauthn/browser";
import { publicApiErrorMessage } from "./user-errors";

export const API_BASE_URL = "/api/backend";

const TOKEN_KEY = "codeforge_token";
const PRESENT_COOKIE = "codeforge_session_present";
const DEVICE_KEY = "codeforge_device";

function getDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  let deviceId = localStorage.getItem(DEVICE_KEY);
  if (!deviceId) {
    // randomUUID is unavailable on an HTTP LAN origin, but getRandomValues
    // remains available and provides the random bytes for a UUID v4.
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    deviceId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    localStorage.setItem(DEVICE_KEY, deviceId);
  }
  return deviceId;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  localStorage.removeItem(TOKEN_KEY);
  return document.cookie.split("; ").some((cookie) => cookie === `${PRESENT_COOKIE}=1`)
    ? "browser-session"
    : null;
}

export function setToken(token: string): void {
  if (!token) return;
  localStorage.removeItem(TOKEN_KEY);
  document.cookie = `${PRESENT_COOKIE}=1; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  window.dispatchEvent(new Event("codeforge-session-change"));
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  document.cookie = `${PRESENT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  window.dispatchEvent(new Event("codeforge-session-change"));
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const deviceId = getDeviceId();
  if (deviceId) headers.set("X-CodeForge-Device", deviceId);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    let code = "unknown";
    try {
      const body = (await res.json()) as Partial<ErrorResponse>;
      if (typeof body.error?.code === "string") code = body.error.code;
    } catch {
      // An upstream HTML error page must never become user-facing copy.
    }
    throw new ApiError(res.status, code, publicApiErrorMessage(res.status, code));
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  register: (payload: RegisterRequest) =>
    request<RegisterResponse>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  verifyEmail: (payload: VerifyEmailRequest) =>
    request<TokenResponse>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  forgotPassword: (payload: ForgotPasswordRequest) =>
    request<ForgotPasswordResponse>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  resetPassword: (payload: ResetPasswordRequest) =>
    request<TokenResponse>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  signOut: () => request<void>("/auth/sign-out", { method: "POST" }),
  signOutEverywhere: () => request<void>("/auth/sign-out-everywhere", { method: "POST" }),
  devices: () => request<DeviceResponse[]>("/auth/devices"),
  signOutDevice: (id: string) => request<void>(`/auth/devices/${encodeURIComponent(id)}/sign-out`, { method: "POST" }),
  respondToSignInAlert: (token: string, response: "me" | "not_me") =>
    request<SignInAlertResponse>("/auth/sign-in-alert/respond", {
      method: "POST",
      body: JSON.stringify({ token, response }),
    }),
  changePassword: (payload: ChangePasswordRequest) =>
    request<TokenResponse>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteAccount: (payload: DeleteAccountRequest) =>
    request<DeleteAccountResponse>("/auth/delete-account", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  resendCode: (email: string) =>
    request<RegisterResponse>("/auth/resend-code", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  login: (payload: LoginRequest) =>
    request<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  completePasswordLogin: (ticket: string, totpCode: string) =>
    request<TokenResponse>("/auth/login/complete", {
      method: "POST", body: JSON.stringify({ ticket, totp_code: totpCode }),
    }),
  completeRecoveryLogin: (ticket: string, recoveryCode: string) =>
    request<TokenResponse>("/auth/login/complete", {
      method: "POST", body: JSON.stringify({ ticket, recovery_code: recoveryCode }),
    }),
  passkeys: () => request<PasskeyInfo[]>("/auth/passkeys"),
  passkeyRegistrationOptions: (currentPassword: string, totpCode?: string) =>
    request<PasskeyOptions<PublicKeyCredentialCreationOptionsJSON>>("/auth/passkeys/register/options", {
      method: "POST", body: JSON.stringify({ current_password: currentPassword, totp_code: totpCode }),
    }),
  registerPasskey: (challengeId: string, credential: RegistrationResponseJSON, label: string) =>
    request<PasskeyInfo>("/auth/passkeys/register/verify", {
      method: "POST", body: JSON.stringify({ challenge_id: challengeId, credential, label }),
    }),
  deletePasskey: (id: string, currentPassword: string, totpCode?: string) =>
    request<void>(`/auth/passkeys/${encodeURIComponent(id)}/delete`, {
      method: "POST", body: JSON.stringify({ current_password: currentPassword, totp_code: totpCode }),
    }),
  passkeyLoginOptions: () =>
    request<PasskeyOptions<PublicKeyCredentialRequestOptionsJSON>>("/auth/passkeys/login/options", { method: "POST" }),
  verifyPasskeyLogin: (challengeId: string, credential: AuthenticationResponseJSON) =>
    request<PasskeyLoginResult>("/auth/passkeys/login/verify", {
      method: "POST", body: JSON.stringify({ challenge_id: challengeId, credential }),
    }),
  passwordMfaPasskeyOptions: (ticket: string) =>
    request<PasskeyOptions<PublicKeyCredentialRequestOptionsJSON>>("/auth/passkeys/mfa/options", {
      method: "POST", body: JSON.stringify({ ticket }),
    }),
  verifyPasswordMfaPasskey: (ticket: string, challengeId: string, credential: AuthenticationResponseJSON) =>
    request<PasskeyLoginResult>("/auth/passkeys/mfa/verify", {
      method: "POST", body: JSON.stringify({ ticket, challenge_id: challengeId, credential }),
    }),
  me: () => request<UserResponse>("/auth/me"),
  setupTotp: (currentPassword: string) =>
    request<TotpSetupResponse>("/auth/totp/setup", { method: "POST", body: JSON.stringify({ current_password: currentPassword }) }),
  verifyTotp: (code: string) =>
    request<{ codes: string[] }>("/auth/totp/verify", { method: "POST", body: JSON.stringify({ code }) }),
  regenerateRecoveryCodes: (currentPassword: string, totpCode: string) =>
    request<{ codes: string[] }>("/auth/recovery-codes/regenerate", {
      method: "POST", body: JSON.stringify({ current_password: currentPassword, totp_code: totpCode }),
    }),
  disableTotp: (currentPassword: string, code: string, recovery = false) =>
    request<TokenResponse>("/auth/totp/disable", {
      method: "POST",
      body: JSON.stringify(recovery ? { current_password: currentPassword, recovery_code: code } : { current_password: currentPassword, code }),
    }),

  sendContactMessage: (payload: ContactRequest) =>
    request<ContactResponse>("/contact", { method: "POST", body: JSON.stringify(payload) }),

  adminOverview: () => request<AdminOverviewResponse>("/admin/overview"),
  adminRuns: (filters: {
    q?: string;
    status?: string;
    rag_enabled?: boolean;
    acceptance_level?: string;
    failure_category?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    page_size?: number;
  } = {}) => {
    const search = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") search.set(key, String(value));
    });
    return request<AdminRunPage>(`/admin/runs${search.size ? `?${search}` : ""}`);
  },
  adminRun: (id: string) => request<AdminRunDetail>(`/admin/runs/${id}`),
  adminCancelRun: (id: string, reason: string) =>
    request<AdminActionResponse>(`/admin/runs/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  adminRetryRun: (id: string, reason: string) =>
    request<AdminActionResponse>(`/admin/runs/${id}/retry`, { method: "POST", body: JSON.stringify({ reason }) }),
  adminRunArtifacts: (id: string) => request<ArtifactListResponse>(`/admin/runs/${id}/artifacts`),
  adminUsers: (filters: { q?: string; date_from?: string; date_to?: string; page?: number; page_size?: number } = {}) => {
    const search = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== "") search.set(key, String(value)); });
    return request<AdminUserPage>(`/admin/users${search.size ? `?${search}` : ""}`);
  },
  adminUser: (id: string) => request<AdminUserDetail>(`/admin/users/${id}`),
  adminRevokeUserSessions: (id: string, reason: string) =>
    request<AdminActionResponse>(`/admin/users/${id}/revoke-sessions`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  adminSuspendUser: (id: string, reason: string) => request<AdminActionResponse>(`/admin/users/${id}/suspend`, { method: "POST", body: JSON.stringify({ reason }) }),
  adminRestoreUser: (id: string, reason: string) => request<AdminActionResponse>(`/admin/users/${id}/restore`, { method: "POST", body: JSON.stringify({ reason }) }),
  adminVerifyUserEmail: (id: string, reason: string) => request<AdminActionResponse>(`/admin/users/${id}/verify-email`, { method: "POST", body: JSON.stringify({ reason }) }),
  adminSetUserLimits: (id: string, projectLimit: number | null, monthlyRunLimit: number | null, reason: string) => request<AdminActionResponse>(`/admin/users/${id}/limits`, { method: "POST", body: JSON.stringify({ project_limit: projectLimit, monthly_run_limit: monthlyRunLimit, reason }) }),
  adminDeleteUser: (id: string, currentPassword: string, confirmation: string, reason: string) =>
    request<DeleteAccountResponse>(`/admin/users/${id}/delete`, {
      method: "POST",
      body: JSON.stringify({ current_password: currentPassword, confirmation, reason }),
    }),
  adminQuality: () => request<AdminQualityResponse>("/admin/quality"),
  adminSystemHealth: () => request<AdminSystemHealthResponse>("/admin/system-health"),
  adminAuditLog: (filters: { action?: string; date_from?: string; date_to?: string; page?: number; page_size?: number } = {}) => {
    const search = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== "") search.set(key, String(value)); });
    return request<AdminAuditPage>(`/admin/audit-log${search.size ? `?${search}` : ""}`);
  },
  adminMonitoring: (days = 30) => request<AdminMonitoringResponse>(`/admin/monitoring?days=${days}`),

  listProjects: () => request<ProjectResponse[]>("/projects"),
  projectOverview: (options: { cursor?: string; q?: string } = {}) => {
    const search = new URLSearchParams();
    if (options.cursor) search.set("cursor", options.cursor);
    if (options.q) search.set("q", options.q);
    return request<ProjectOverviewPage>(`/projects/overview${search.size ? `?${search}` : ""}`);
  },
  createProject: (payload: ProjectCreate) =>
    request<ProjectResponse>("/projects", { method: "POST", body: JSON.stringify(payload) }),
  getProject: (id: string) => request<ProjectResponse>(`/projects/${id}`),
  deleteProject: (id: string) =>
    request<ProjectDeleteResponse>(`/projects/${id}`, { method: "DELETE" }),
  listProjectRuns: (projectId: string) => request<RunSummary[]>(`/projects/${projectId}/runs`),
  projectRunPage: (projectId: string, cursor?: string) => request<ProjectRunPage>(
    `/projects/${projectId}/runs/page${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
  ),

  createRun: (payload: RunCreate) =>
    request<RunCreateResponse>("/runs", { method: "POST", body: JSON.stringify(payload) }),
  getRun: (id: string) => request<RunResponse>(`/runs/${id}`),
  getPreview: (id: string) => request<PreviewInfo>(`/runs/${id}/preview`),
  sendPreviewRequest: (id: string, payload: PreviewCall) =>
    request<PreviewResult>(`/runs/${id}/preview/request`, { method: "POST", body: JSON.stringify(payload) }),
  resetPreview: (id: string) => request<void>(`/runs/${id}/preview`, { method: "DELETE" }),
  getDeployment: (id: string) => request<DeploymentInfo>(`/runs/${id}/deployment`),
  publishRun: (id: string) => request<DeploymentCreated>(`/runs/${id}/deployment`, { method: "POST" }),
  rotateDeploymentKey: (id: string) => request<DeploymentCreated>(`/runs/${id}/deployment/rotate-key`, { method: "POST" }),
  unpublishRun: (id: string) => request<void>(`/runs/${id}/deployment`, { method: "DELETE" }),
  getRunFiles: (id: string) => request<FileTreeResponse>(`/runs/${id}/files`),
  getRunFileHistory: (id: string) => request<FileHistoryResponse>(`/runs/${id}/file-history`),
  approveRun: (id: string, payload: ApprovalRequest) =>
    request<ApprovalResponse>(`/runs/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  cancelRun: (id: string) => request<RunCreateResponse>(`/runs/${id}/cancel`, { method: "POST" }),
  listRunArtifacts: (id: string) => request<ArtifactListResponse>(`/runs/${id}/artifacts`),
};

/** Downloads one artifact as a browser file save through the session proxy. */
export async function downloadArtifact(
  runId: string,
  fileId: string,
  filename: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/runs/${runId}/artifacts/${fileId}`);
  if (!res.ok) throw new ApiError(res.status, "download_failed", "Couldn't download the artifact.");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadAdminArtifact(
  runId: string,
  fileId: string,
  filename: string,
): Promise<void> {
  await downloadAuthenticated(`/admin/runs/${runId}/artifacts/${fileId}`, filename);
}

export async function downloadAdminCsv(kind: "runs" | "users" | "audit-log"): Promise<void> {
  await downloadAuthenticated(`/admin/${kind}/export.csv`, `codeforge-${kind}.csv`);
}

async function downloadAuthenticated(path: string, filename: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) throw new ApiError(res.status, "download_failed", "Couldn't download this file.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** The most recent generated-code archive for a run — what "Download code" saves. */
export async function downloadLatestFileTree(runId: string): Promise<void> {
  const { artifacts } = await api.listRunArtifacts(runId);
  const fileTrees = artifacts.filter((a) => a.kind === "file_tree");
  if (fileTrees.length === 0) {
    throw new ApiError(404, "no_artifacts", "No generated code has been saved for this run yet.");
  }
  const latest = fileTrees.reduce((a, b) => (b.iteration > a.iteration ? b : a));
  await downloadArtifact(runId, latest.file_id, latest.filename);
}
