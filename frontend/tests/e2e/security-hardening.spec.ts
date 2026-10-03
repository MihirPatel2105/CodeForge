import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { POST } from "../../app/api/backend/[...path]/route";

test("production pages nonce their scripts and block framing and injected scripts", async ({ page }) => {
  await page.route("**/", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace("<head>",
      "<head><script>window.__injectedSecurityProbe = true</script>");
    await route.fulfill({ response, body });
  });
  const response = await page.goto("/");
  const headers = response!.headers();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  const policy = headers["content-security-policy"];
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("object-src 'none'");
  const scripts = policy.split(";").map((part) => part.trim()).find((part) => part.startsWith("script-src"))!;
  expect(scripts).not.toContain("unsafe-inline");
  expect(scripts).not.toContain("unsafe-eval");
  const nonce = scripts.match(/'nonce-([^']+)'/)![1];
  const inlineNonces = await page.locator("script:not([src])").evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLScriptElement).nonce));
  expect(inlineNonces.length).toBeGreaterThan(0);
  expect(inlineNonces.filter(Boolean).every((value) => value === nonce)).toBe(true);
  expect(inlineNonces.filter((value) => !value)).toHaveLength(1);
  expect(await page.evaluate(() => Reflect.get(window, "__injectedSecurityProbe"))).toBeUndefined();
  const second = await page.request.get("/");
  expect(second.headers()["content-security-policy"]).not.toBe(policy);
});

test("chunked oversized proxy requests stop before reaching the backend", async () => {
  const saved = { ...process.env };
  const originalFetch = globalThis.fetch;
  let forwarded = false;
  let cancelled = false;
  let chunk = 0;
  process.env.CODEFORGE_FRONTEND_ORIGIN = "https://frontend.example.com";
  process.env.CODEFORGE_API_INTERNAL_URL = "https://api.example.com";
  process.env.CODEFORGE_PROXY_IP_SECRET = "a-proxy-secret-that-is-at-least-32-characters";
  globalThis.fetch = async () => {
    forwarded = true;
    return new Response("{}");
  };
  try {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunk += 1;
        controller.enqueue(new Uint8Array(chunk === 1 ? 1024 * 1024 : 1));
      },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 });
    const request = new NextRequest("https://frontend.example.com/api/backend/projects", {
      method: "POST", headers: { origin: "https://frontend.example.com" }, body,
      duplex: "half",
    } as NonNullable<ConstructorParameters<typeof NextRequest>[1]>);
    const response = await POST(request);
    expect(response.status).toBe(413);
    expect(forwarded).toBe(false);
    expect(cancelled).toBe(true);
    expect(chunk).toBe(2);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = saved;
  }
});
