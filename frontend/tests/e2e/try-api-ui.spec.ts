import { expect, test } from "@playwright/test";

const runId = "507f1f77bcf86cd799439012";

test("a user can send a generated API request and reset preview data", async ({ page }) => {
  await page.addInitScript(() => document.cookie = "codeforge_session_present=1; Path=/");
  await page.route("**/api/backend/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ id: "user-1", email: "user@example.com", first_name: "Regular", last_name: "User", created_at: "2026-09-23T00:00:00Z", is_admin: false, email_verified: true, totp_enabled: false }),
  }));
  await page.route(`**/api/backend/runs/${runId}/preview`, (route) => route.fulfill({
    status: route.request().method() === "DELETE" ? 204 : 200,
    contentType: "application/json",
    body: route.request().method() === "DELETE" ? "" : JSON.stringify({
      expires_after_seconds: 900,
      session_started: true,
      operations: [
        { method: "POST", path: "/items", summary: "Create an item", has_body: true, example_body: { name: "example" } },
        { method: "GET", path: "/items", summary: "List items", has_body: false, example_body: null },
      ],
    }),
  }));
  await page.route(`**/api/backend/runs/${runId}/deployment`, (route) => route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "not_found", message: "No published API" } }) }));
  let sent: unknown;
  await page.route(`**/api/backend/runs/${runId}/preview/request`, (route) => {
    sent = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: 201, content_type: "application/json", body: '{"name":"sample"}', truncated: false, duration_ms: 42, session_started: false }) });
  });

  await page.goto(`/runs/${runId}/try`);
  await expect(page.getByRole("heading", { name: "Try your API" })).toBeVisible();
  const selectBox = await page.getByRole("combobox", { name: "Endpoint" }).boundingBox();
  const chevronBox = await page.getByTestId("endpoint-chevron").boundingBox();
  expect(selectBox && chevronBox).toBeTruthy();
  expect(Math.abs((selectBox!.y + selectBox!.height / 2) - (chevronBox!.y + chevronBox!.height / 2))).toBeLessThan(2);
  expect(selectBox!.x + selectBox!.width - (chevronBox!.x + chevronBox!.width)).toBeGreaterThan(8);
  await expect(page.getByLabel("JSON body")).toContainText("example");
  await page.getByLabel("JSON body").fill('{"name":"sample"}');
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("HTTP 201 · 42 ms")).toBeVisible();
  await expect(page.getByText(/"name": "sample"/)).toBeVisible();
  expect(sent).toEqual({ method: "POST", path: "/items", body: { name: "sample" } });

  await page.getByRole("button", { name: "Reset data" }).click();
  await expect(page.getByText("Send a request to see what your API returns.")).toBeVisible();
});

test("run flow pages navigate between API options, tester, publish, and run", async ({ page }) => {
  await page.addInitScript(() => document.cookie = "codeforge_session_present=1; Path=/");
  await page.route("**/api/backend/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ id: "user-1", email: "user@example.com", first_name: "Regular", last_name: "User", created_at: "2026-09-23T00:00:00Z", is_admin: false, email_verified: true, totp_enabled: false }),
  }));
  await page.route(`**/api/backend/runs/${runId}/preview`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ expires_after_seconds: 900, session_started: false, operations: [{ method: "GET", path: "/items", summary: "List items", has_body: false, example_body: null }] }),
  }));
  await page.route(`**/api/backend/runs/${runId}/deployment`, (route) => route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "not_found", message: "No published API" } }) }));

  await page.goto(`/runs/${runId}/use`);
  const exitStarted = await page.getByRole("link", { name: /Open tester/ }).evaluate((link) => {
    (link as HTMLAnchorElement).click();
    return document.querySelector("[data-run-flow-page]")?.classList.contains("cf-run-flow-exit");
  });
  expect(exitStarted).toBe(true);
  await expect(page.getByRole("heading", { name: "Try your API" })).toBeVisible();
  await page.getByRole("link", { name: "Ways to use your API" }).click();
  await page.getByRole("link", { name: /Open publish guide/ }).click();
  await expect(page.getByRole("heading", { name: "Publish your API" })).toBeVisible();
  await page.getByRole("link", { name: "Back to API options" }).click();
  await page.getByRole("link", { name: "Back to run" }).click();
  await expect(page).toHaveURL(new RegExp(`/runs/${runId}$`));
});

test("a user can publish an API and see its one-time key", async ({ page }) => {
  await page.addInitScript(() => document.cookie = "codeforge_session_present=1; Path=/");
  await page.route("**/api/backend/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ id: "user-1", email: "user@example.com", first_name: "Regular", last_name: "User", created_at: "2026-09-23T00:00:00Z", is_admin: false, email_verified: true, totp_enabled: false }),
  }));
  await page.route(`**/api/backend/runs/${runId}/preview`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ expires_after_seconds: 900, session_started: false, operations: [{ method: "GET", path: "/items", summary: "List items", has_body: false, example_body: null, example_response: [{ id: "example", name: "example" }] }] }),
  }));
  let published = false;
  await page.route(`**/api/backend/runs/${runId}/deployment`, (route) => {
    const method = route.request().method();
    if (method === "POST") published = true;
    if (method === "DELETE") published = false;
    if (!published) return route.fulfill({ status: method === "DELETE" ? 204 : 404, contentType: "application/json", body: method === "DELETE" ? "" : JSON.stringify({ error: { code: "not_found", message: "No published API" } }) });
    return route.fulfill({ status: method === "POST" ? 201 : 200, contentType: "application/json", body: JSON.stringify({ id: "deployment-1", run_id: runId, url: "http://localhost:8000/api/v1/deployments/deployment-1", key_prefix: "cf_live_abc", status: "active", created_at: "2026-09-24T00:00:00Z", ...(method === "POST" ? { api_key: "cf_live_abc123" } : {}) }) });
  });

  await page.goto(`/runs/${runId}/publish`);
  await expect(page).toHaveURL(new RegExp(`/runs/${runId}/publish$`));
  await page.getByRole("button", { name: "Publish API" }).click();
  await expect(page.getByText("cf_live_abc123", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Show key" }).click();
  await expect(page.getByText("cf_live_abc123", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hide key" }).click();
  await expect(page.getByText("cf_live_abc123", { exact: true })).toHaveCount(0);
  await expect(page.getByText("http://localhost:8000/api/v1/deployments/deployment-1", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Connection details" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Make a request" })).toBeVisible();
  await expect(page.getByText(/reachable only from the device running CodeForge/)).toBeVisible();
  await expect(page.getByRole("group", { name: "Published endpoints" }).getByRole("button", { name: /GET.*\/items/ })).toBeVisible();
  const responsePanel = page.getByRole("button", { name: "Example response shape" });
  await expect(responsePanel).toHaveAttribute("aria-expanded", "false");
  await responsePanel.click();
  await expect(responsePanel).toHaveAttribute("aria-expanded", "true");
  await responsePanel.click();
  await expect(responsePanel).toHaveAttribute("aria-expanded", "false");
  const setupPanel = page.getByRole("button", { name: "Setup instructions" });
  const helpPanel = page.getByRole("button", { name: "Getting a 404 response?" });
  await setupPanel.click();
  await expect(helpPanel).toHaveAttribute("aria-expanded", "false");
  await expect.poll(async () => (await helpPanel.locator("..").boundingBox())?.height ?? 999).toBeLessThan(90);
  await setupPanel.click();
  await helpPanel.click();
  await expect(setupPanel).toHaveAttribute("aria-expanded", "false");
  await expect.poll(async () => (await setupPanel.locator("..").boundingBox())?.height ?? 999).toBeLessThan(90);
  await page.getByRole("button", { name: "Node.js" }).click();
  await expect(page.getByText(/process\.env\.CODEFORGE_API_KEY/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/The full key was shown when published/)).toBeVisible();
  await expect(page.getByText("cf_live_abc123", { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("heading", { name: "Publish your API" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
