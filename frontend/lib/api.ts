/**
 * REST client for the real backend (docs/STATE_AND_API.md). Every shape here mirrors
 * `lib/types.ts`, which mirrors the backend's Pydantic schemas — no ad-hoc `any`.
 *
 * Auth is a bearer JWT (CLAUDE.md §3: custom JWT, python-jose + passlib), stored in
 * localStorage and attached by `request()` to every call. There is no cookie/session
 * path, which matters later for the SSE hook: the native `EventSource` API cannot send
 * custom headers, so the stream can't use it — see `lib/use-run-stream.ts`.
 */

import type {
  TokenResponse,
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
  RunCreate,
  RunCreateResponse,
  RunResponse,
  RunSummary,
  FileTreeResponse,
  ApprovalRequest,
  ApprovalResponse,
  ArtifactListResponse,
  ErrorResponse,
} from "./types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "codeforge_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
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
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    let message = res.statusText;
    let code = "unknown";
    try {
      const body = (await res.json()) as Partial<ErrorResponse>;
      if (body.error) {
        message = body.error.message;
        code = body.error.code;
      }
    } catch {
      // Non-JSON error body (e.g. a raw 502 from something in front of the API) —
      // the statusText fallback above already covers it.
    }
    throw new ApiError(res.status, code, message);
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
    request<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request<UserResponse>("/auth/me"),

  listProjects: () => request<ProjectResponse[]>("/projects"),
  createProject: (payload: ProjectCreate) =>
    request<ProjectResponse>("/projects", { method: "POST", body: JSON.stringify(payload) }),
  getProject: (id: string) => request<ProjectResponse>(`/projects/${id}`),
  listProjectRuns: (projectId: string) => request<RunSummary[]>(`/projects/${projectId}/runs`),

  createRun: (payload: RunCreate) =>
    request<RunCreateResponse>("/runs", { method: "POST", body: JSON.stringify(payload) }),
  getRun: (id: string) => request<RunResponse>(`/runs/${id}`),
  getRunFiles: (id: string) => request<FileTreeResponse>(`/runs/${id}/files`),
  approveRun: (id: string, payload: ApprovalRequest) =>
    request<ApprovalResponse>(`/runs/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  cancelRun: (id: string) => request<RunCreateResponse>(`/runs/${id}/cancel`, { method: "POST" }),
  listRunArtifacts: (id: string) => request<ArtifactListResponse>(`/runs/${id}/artifacts`),
};

/** Downloads one artifact as a browser file save — a plain `<a href>` can't carry the
 * bearer token, so this fetches the bytes with auth and saves them via an object URL. */
export async function downloadArtifact(
  runId: string,
  fileId: string,
  filename: string,
): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}/runs/${runId}/artifacts/${fileId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, "download_failed", "Couldn't download the artifact.");

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
