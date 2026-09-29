import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { publicApiErrorMessage } from "@/lib/user-errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SESSION_COOKIE = process.env.NODE_ENV === "production"
  ? "__Host-codeforge_session"
  : "codeforge_session";
const PRESENT_COOKIE = "codeforge_session_present";
const PUBLIC_TOKEN_MARKER = "browser-session";
const SESSION_MAX_AGE = 24 * 60 * 60;
const MAX_REQUEST_BYTES = 1024 * 1024;
const PROXY_PREFIX = "/api/backend";

function backendOrigin(): string | null {
  const configured = process.env.CODEFORGE_API_INTERNAL_URL;
  if (!configured) {
    return process.env.NODE_ENV === "development" ? "http://localhost:8000" : null;
  }
  try {
    const url = new URL(configured);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) return null;
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function productionFrontendConfigured(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const configured = process.env.CODEFORGE_FRONTEND_ORIGIN;
  if (
    !configured ||
    !process.env.CODEFORGE_PROXY_IP_SECRET ||
    process.env.CODEFORGE_PROXY_IP_SECRET.length < 32
  ) return false;
  try {
    const url = new URL(configured);
    return url.protocol === "https:" && url.origin === configured;
  } catch {
    return false;
  }
}

function clientIp(request: NextRequest): string | null {
  // Vercel replaces this header at ingress. A self-hosted forwarded header can be
  // supplied by the caller, so it must never be signed without a trusted ingress.
  if (!process.env.VERCEL) return null;
  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  return ip && isIP(ip) ? ip : null;
}

function isAllowedMutation(request: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  // In dev, Next may report localhost as nextUrl.origin even when a phone
  // reached the server through its LAN address. The Host header reflects the
  // address the browser actually requested. Production uses the fixed origin.
  const expected = process.env.CODEFORGE_FRONTEND_ORIGIN ??
    `${request.nextUrl.protocol}//${request.headers.get("host") ?? request.nextUrl.host}`;
  const origin = request.headers.get("origin");
  if (origin) return origin === expected;
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === expected;
    } catch {
      return false;
    }
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}

function cookieOptions(request: NextRequest) {
  const secure = (process.env.CODEFORGE_FRONTEND_ORIGIN ?? request.nextUrl.origin)
    .startsWith("https://");
  return { secure, sameSite: "lax" as const, path: "/", maxAge: SESSION_MAX_AGE };
}

function clearSession(response: NextResponse, request: NextRequest): void {
  const options = cookieOptions(request);
  response.cookies.set(SESSION_COOKIE, "", { ...options, httpOnly: true, maxAge: 0 });
  response.cookies.set(PRESENT_COOKIE, "", { ...options, httpOnly: false, maxAge: 0 });
}

function proxyError(status: number, code: string): NextResponse {
  return NextResponse.json(
    { error: { code, message: publicApiErrorMessage(status, code) } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function proxy(request: NextRequest): Promise<NextResponse> {
  if (!isAllowedMutation(request)) {
    return proxyError(403, "forbidden");
  }

  if (!productionFrontendConfigured()) {
    return proxyError(503, "service_unavailable");
  }

  const origin = backendOrigin();
  if (!origin) {
    return proxyError(503, "service_unavailable");
  }

  const path = request.nextUrl.pathname.slice(PROXY_PREFIX.length);
  if (!path.startsWith("/") || path.startsWith("//")) {
    return proxyError(400, "bad_request");
  }
  const headers = new Headers();
  for (const name of [
    "accept", "content-type", "last-event-id", "x-codeforge-device", "user-agent",
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (session) headers.set("authorization", `Bearer ${session}`);
  const ip = clientIp(request);
  if (
    process.env.VERCEL &&
    process.env.NODE_ENV === "production" &&
    !ip &&
    request.method === "POST" &&
    path.startsWith("/auth/")
  ) {
    return proxyError(503, "service_unavailable");
  }
  const secret = process.env.CODEFORGE_PROXY_IP_SECRET;
  if (ip && secret) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    headers.set("x-codeforge-client-ip", ip);
    headers.set("x-codeforge-client-time", timestamp);
    headers.set(
      "x-codeforge-client-signature",
      createHmac("sha256", secret).update(`${ip}.${timestamp}`).digest("hex"),
    );
  }

  const reportedLength = Number(request.headers.get("content-length") ?? 0);
  if (reportedLength > MAX_REQUEST_BYTES) {
    return proxyError(413, "too_large");
  }
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();
  if (body && body.byteLength > MAX_REQUEST_BYTES) {
    return proxyError(413, "too_large");
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${origin}${path}${request.nextUrl.search}`, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
      signal: request.signal,
    });
  } catch {
    return proxyError(502, "service_unavailable");
  }

  const responseHeaders = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  for (const name of ["content-type", "content-disposition", "retry-after"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  if (upstream.status >= 400) {
    let code = "request_failed";
    if (upstream.headers.get("content-type")?.includes("application/json")) {
      try {
        const payload = await upstream.json();
        const upstreamCode = payload?.error?.code;
        if (["rate_limited", "account_suspended", "usage_limit_reached"].includes(upstreamCode)) {
          code = upstreamCode;
        }
      } catch {
        // Never forward an upstream error body to the browser.
      }
    }
    const response = NextResponse.json(
      { error: { code, message: publicApiErrorMessage(upstream.status, code) } },
      {
        status: upstream.status,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          ...(responseHeaders.has("retry-after") ? { "Retry-After": responseHeaders.get("retry-after")! } : {}),
        },
      },
    );
    if (upstream.status === 401 && ["/auth/me", "/auth/sign-out"].includes(path)) {
      clearSession(response, request);
    }
    return response;
  }

  if (
    path.startsWith("/auth/") &&
    upstream.ok &&
    upstream.headers.get("content-type")?.includes("application/json")
  ) {
    let payload: Record<string, unknown>;
    try {
      payload = await upstream.json();
    } catch {
      return proxyError(502, "service_unavailable");
    }
    if (
      payload &&
      typeof payload === "object" &&
      typeof payload.access_token === "string" &&
      payload.access_token
    ) {
      const token = payload.access_token;
      payload.access_token = PUBLIC_TOKEN_MARKER;
      const response = NextResponse.json(payload, {
        status: upstream.status,
        headers: responseHeaders,
      });
      response.cookies.set(SESSION_COOKIE, token, { ...cookieOptions(request), httpOnly: true });
      response.cookies.set(PRESENT_COOKIE, "1", { ...cookieOptions(request), httpOnly: false });
      return response;
    }
    return NextResponse.json(payload, { status: upstream.status, headers: responseHeaders });
  }

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
  const signedOut = ["/auth/sign-out", "/auth/sign-out-everywhere", "/auth/delete-account"]
    .includes(path);
  if (
    (upstream.ok && signedOut) ||
    (upstream.status === 401 && ["/auth/me", "/auth/sign-out"].includes(path))
  ) {
    clearSession(response, request);
  }
  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
