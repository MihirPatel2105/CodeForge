import { expect, test } from "@playwright/test";

const runId = "507f1f77bcf86cd799439012";

test("a user can send a generated API request and reset preview data", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("codeforge_token", "ui-test-token"));
  await page.route("http://localhost:8000/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ id: "user-1", email: "user@example.com", first_name: "Regular", last_name: "User", created_at: "2026-09-23T00:00:00Z", is_admin: false, email_verified: true, totp_enabled: false }),
  }));
  await page.route(`http://localhost:8000/runs/${runId}/preview`, (route) => route.fulfill({
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
  await page.route(`http://localhost:8000/runs/${runId}/deployment`, (route) => route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "not_found", message: "No published API" } }) }));
  let sent: unknown;
  await page.route(`http://localhost:8000/runs/${runId}/preview/request`, (route) => {
    sent = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: 201, content_type: "application/json", body: '{"name":"sample"}', truncated: false, duration_ms: 42, session_started: false }) });
  });

  await page.goto(`/runs/${runId}/try`);
  await expect(page.getByRole("heading", { name: "Try your API" })).toBeVisible();
  await expect(page.getByLabel("JSON body")).toContainText("example");
  await page.getByLabel("JSON body").fill('{"name":"sample"}');
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("HTTP 201 · 42 ms")).toBeVisible();
  await expect(page.getByText(/"name": "sample"/)).toBeVisible();
  expect(sent).toEqual({ method: "POST", path: "/items", body: { name: "sample" } });

  await page.getByRole("button", { name: "Reset data" }).click();
  await expect(page.getByText("Send a request to see what your API returns.")).toBeVisible();
});

test("a user can publish an API and see its one-time key", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("codeforge_token", "ui-test-token"));
  await page.route("http://localhost:8000/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ id: "user-1", email: "user@example.com", first_name: "Regular", last_name: "User", created_at: "2026-09-23T00:00:00Z", is_admin: false, email_verified: true, totp_enabled: false }),
  }));
  await page.route(`http://localhost:8000/runs/${runId}/preview`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ expires_after_seconds: 900, session_started: false, operations: [{ method: "GET", path: "/items", summary: "List items", has_body: false, example_body: null }] }),
  }));
  let published = false;
  await page.route(`http://localhost:8000/runs/${runId}/deployment`, (route) => {
    const method = route.request().method();
    if (method === "POST") published = true;
    if (method === "DELETE") published = false;
    if (!published) return route.fulfill({ status: method === "DELETE" ? 204 : 404, contentType: "application/json", body: method === "DELETE" ? "" : JSON.stringify({ error: { code: "not_found", message: "No published API" } }) });
    return route.fulfill({ status: method === "POST" ? 201 : 200, contentType: "application/json", body: JSON.stringify({ id: "deployment-1", run_id: runId, url: "https://api.example.test/api/v1/deployments/deployment-1", key_prefix: "cf_live_abc", status: "active", created_at: "2026-09-24T00:00:00Z", ...(method === "POST" ? { api_key: "cf_live_abc123" } : {}) }) });
  });

  await page.goto(`/runs/${runId}/try`);
  await page.getByRole("button", { name: "Publish API" }).click();
  await expect(page.getByText("cf_live_abc123", { exact: true })).toBeVisible();
  await expect(page.getByText("https://api.example.test/api/v1/deployments/deployment-1", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/The full key was shown when published/)).toBeVisible();
  await expect(page.getByText("cf_live_abc123", { exact: true })).toHaveCount(0);
});
