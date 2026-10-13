import { expect, test } from "@playwright/test";

const runId = "507f1f77bcf86cd799439012";

test("copy response copies the selected body view even while searching", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`/runs/${runId}/try`);
  await page.getByRole("button", { name: "Send request" }).click();
  const response = page.getByRole("region", { name: "Response", exact: true });
  await response.getByRole("searchbox", { name: "Search response" }).fill("sample");
  await response.getByRole("button", { name: "Copy response" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('{\n  "items": [\n    {\n      "name": "sample"\n    }\n  ]\n}');
  await expect(response.getByText("Response copied.", { exact: true })).toHaveCount(0);
  await expect(response.getByRole("button", { name: "Response copied", exact: true })).toBeVisible();
  await expect(response.getByRole("button", { name: "Copy response", exact: true })).toBeVisible({ timeout: 3000 });
  await response.getByRole("button", { name: "Raw", exact: true }).click();
  await response.getByRole("button", { name: "Copy response" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('{"items":[{"name":"sample"}]}');
});

test("search response treats punctuation literally and navigates matches with keyboard", async ({ page }) => {
  await page.route(`**/api/backend/runs/${runId}/preview/request`, route => route.fulfill({ json: {
    status: 200, content_type: "text/plain", body: "a.b first\nA.B second\naXb", truncated: false, duration_ms: 2, session_started: false,
  } }));
  await page.goto(`/runs/${runId}/try`);
  await page.getByRole("button", { name: "Send request" }).click();
  const response = page.getByRole("region", { name: "Response", exact: true });
  const search = response.getByRole("searchbox", { name: "Search response" });
  await search.fill("a.b");
  await expect(response.getByRole("status").filter({ hasText: "1 of 2 matches" })).toBeVisible();
  await expect(response.locator("mark")).toHaveText("a.b");
  await search.press("Enter");
  await expect(response.locator("mark")).toHaveText("A.B");
  await expect(response.getByRole("status").filter({ hasText: "2 of 2 matches" })).toBeVisible();
  await response.getByRole("button", { name: "Next match" }).click();
  await expect(response.locator("mark")).toHaveText("a.b");
  await search.press("Shift+Enter");
  await expect(response.locator("mark")).toHaveText("A.B");
  await response.getByRole("button", { name: "Previous match" }).click();
  await expect(response.locator("mark")).toHaveText("a.b");
  await search.fill("missing");
  await expect(response.getByText("No matches", { exact: true })).toBeVisible();
  await expect(response.getByRole("button", { name: "Next match" })).toBeDisabled();
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(response.locator("mark")).toHaveCount(0);
  await expect(response.locator("pre")).toHaveText("a.b first\nA.B second\naXb");
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("clipboard failure gives a usable message without exposing exception details", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", {
    value: { writeText: async () => { throw new Error("internal clipboard failure"); } }, configurable: true,
  }));
  await page.goto(`/runs/${runId}/try`);
  await page.getByRole("button", { name: "Send request" }).click();
  await page.getByRole("button", { name: "Copy response" }).click();
  await expect(page.getByText("Could not copy. Select the response text and copy it.", { exact: true })).toBeVisible();
  await expect(page.getByText("internal clipboard failure")).toHaveCount(0);
});

test("a new response resets search navigation and empty bodies cannot be copied", async ({ page }) => {
  let body = "sample sample";
  await page.route(`**/api/backend/runs/${runId}/preview/request`, route => route.fulfill({ json: {
    status: body ? 200 : 204, content_type: "text/plain", body, truncated: false, duration_ms: 2, session_started: false,
  } }));
  await page.goto(`/runs/${runId}/try`);
  await page.getByRole("button", { name: "Send request" }).click();
  const search = page.getByRole("searchbox", { name: "Search response" });
  await search.fill("sample");
  await search.press("Enter");
  await expect(page.getByText("2 of 2 matches", { exact: true })).toBeVisible();
  body = "sample";
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("1 of 1 matches", { exact: true })).toBeVisible();
  body = "";
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByRole("button", { name: "Copy response" })).toBeDisabled();
  await expect(page.getByText("No response body", { exact: true })).toBeVisible();
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => document.cookie = "codeforge_session_present=1; Path=/");
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: {
    id: "user-1", email: "user@example.com", first_name: "Regular", is_admin: false, email_verified: true,
  } }));
  await page.route(`**/api/backend/runs/${runId}/preview`, route => route.fulfill({
    status: route.request().method() === "DELETE" ? 204 : 200,
    body: route.request().method() === "DELETE" ? "" : JSON.stringify({
      expires_after_seconds: 900, session_started: false,
      operations: [{ method: "GET", path: "/items", summary: "List items", has_body: false, example_body: null }],
    }), contentType: "application/json",
  }));
  await page.route(`**/api/backend/runs/${runId}/preview/request`, route => route.fulfill({ json: {
    status: 200, content_type: "application/json", headers: { "content-type": "application/json", "cache-control": "no-cache" },
    body: '{"items":[{"name":"sample"}]}', truncated: false, duration_ms: 12, session_started: false,
  } }));
});

test("query editor encodes repeated values and restores saved requests without sending", async ({ page }) => {
  await page.goto(`/runs/${runId}/try`);
  await page.getByRole("button", { name: "Add parameter" }).click();
  await page.getByLabel("Parameter name 1").fill("tag");
  await page.getByLabel("Parameter value 1").fill("a & b");
  await page.getByRole("button", { name: "Add parameter" }).click();
  await page.getByLabel("Parameter name 2").fill("tag");
  await page.getByLabel("Parameter value 2").fill("other");
  await page.getByRole("button", { name: "Add parameter" }).click();
  await page.getByLabel("Parameter name 3").fill("ignored");
  await page.getByLabel("Include parameter 3").uncheck();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  const request = page.waitForRequest(`**/runs/${runId}/preview/request`);
  await page.getByRole("button", { name: "Send request" }).click();
  expect((await request).postDataJSON().path).toBe("/items?tag=a+%26+b&tag=other");
  await page.getByRole("button", { name: "Save request", exact: true }).click();
  await page.reload();
  let calls = 0;
  page.on("request", req => { if (req.url().endsWith("/preview/request")) calls++; });
  await page.getByRole("button", { name: "GET /items?tag=a+%26+b&tag=other", exact: true }).click();
  await expect(page.getByLabel("Parameter value 1")).toHaveValue("a & b");
  await expect(page.getByLabel("Parameter value 2")).toHaveValue("other");
  expect(calls).toBe(0);
});

test("response viewer switches between formatted, raw and header views", async ({ page }) => {
  await page.goto(`/runs/${runId}/try`);
  await page.getByRole("button", { name: "Send request" }).click();
  const response = page.getByRole("region", { name: "Response", exact: true });
  await expect(response.locator("pre")).toContainText('"name": "sample"');
  await response.getByRole("button", { name: "Raw", exact: true }).click();
  await expect(response.locator("pre")).toHaveText('{"items":[{"name":"sample"}]}');
  await response.getByRole("button", { name: "Headers", exact: true }).click();
  await expect(response.getByRole("cell", { name: "cache-control", exact: true })).toBeVisible();
  await expect(response.getByRole("cell", { name: "no-cache", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("legacy previews show only known content type and non-JSON stays readable", async ({ page }) => {
  await page.route(`**/api/backend/runs/${runId}/preview/request`, route => route.fulfill({ json: {
    status: 502, content_type: "text/plain", body: "Service unavailable", truncated: true, duration_ms: 8, session_started: false,
  } }));
  await page.goto(`/runs/${runId}/try`);
  await page.getByRole("button", { name: "Send request" }).click();
  const response = page.getByRole("region", { name: "Response", exact: true });
  await expect(response.locator("pre")).toHaveText("Service unavailable");
  await response.getByRole("button", { name: "Headers", exact: true }).click();
  await expect(response.getByRole("cell", { name: "text/plain", exact: true })).toBeVisible();
  await expect(response.getByText("Response shortened. Some content is not shown.")).toBeVisible();
});

test("OpenAPI guidance validates required, typed and allowed parameter values before sending", async ({ page }) => {
  await page.route(`**/api/backend/runs/${runId}/preview`, route => route.fulfill({ json: {
    expires_after_seconds: 900, session_started: false,
    operations: [{ method: "GET", path: "/items/{id}", summary: "Find item", has_body: false, example_body: null,
      parameters: [
        { name: "id", location: "path", required: true, description: "Item number", schema: { type: "integer", minimum: 1 } },
        { name: "limit", location: "query", required: true, description: "Maximum records", schema: { type: "integer", minimum: 1, maximum: 50, default: 10 } },
        { name: "sort", location: "query", required: false, description: "Sort order", schema: { type: "string", enum: ["asc", "desc"] } },
        { name: "active", location: "query", required: false, description: "Active only", schema: { anyOf: [{ type: "boolean" }, { type: "null" }], default: false } },
      ],
    }],
  } }));
  await page.goto(`/runs/${runId}/try`);
  await expect(page.getByText("Item number", { exact: true })).toBeVisible();
  await expect(page.getByText("Allowed: asc, desc", { exact: true })).toBeVisible();
  await expect(page.getByText("Default: false", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Parameter value 1")).toHaveValue("10");
  await page.getByLabel("Path", { exact: true }).fill("/items/nope");
  await expect(page.getByText("id must be an integer.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send request" })).toBeDisabled();
  await page.getByLabel("Path", { exact: true }).fill("/items/3");
  await page.getByLabel("Parameter value 1").fill("51");
  await expect(page.getByText("limit must be at most 50.", { exact: true })).toBeVisible();
  await page.getByLabel("Parameter value 1").fill("5");
  await page.getByLabel("Include parameter 1").uncheck();
  await expect(page.getByText("limit is required.", { exact: true })).toBeVisible();
  await page.getByLabel("Include parameter 1").check();
  await page.getByLabel("Include parameter 2").check();
  await page.getByLabel("Parameter value 2").fill("other");
  await expect(page.getByText("sort must use an allowed value.", { exact: true })).toBeVisible();
  await page.getByLabel("Parameter value 2").fill("desc");
  await page.getByLabel("Include parameter 3").check();
  await page.getByLabel("Parameter value 3").fill("yes");
  await expect(page.getByText("active must be true or false.", { exact: true })).toBeVisible();
  await page.getByLabel("Parameter value 3").fill("false");
  const request = page.waitForRequest(`**/runs/${runId}/preview/request`);
  await page.getByRole("button", { name: "Send request" }).click();
  expect((await request).postDataJSON().path).toBe("/items/3?limit=5&sort=desc&active=false");
  await page.getByRole("button", { name: "Save request", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "GET /items/3?limit=5&sort=desc&active=false", exact: true }).click();
  await expect(page.getByLabel("Parameter value 1")).toHaveValue("5");
  await expect(page.getByRole("button", { name: "Send request" })).toBeEnabled();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("parameter validation includes query values typed directly into the path", async ({ page }) => {
  await page.route(`**/api/backend/runs/${runId}/preview`, route => route.fulfill({ json: {
    expires_after_seconds: 900, session_started: false,
    operations: [{ method: "GET", path: "/items", has_body: false, example_body: null,
      parameters: [{ name: "limit", location: "query", required: true, description: "", schema: { type: "integer" } }],
    }],
  } }));
  await page.goto(`/runs/${runId}/try`);
  await page.getByLabel("Include parameter 1").uncheck();
  await page.getByLabel("Path", { exact: true }).fill("/items?limit=nope");
  await expect(page.getByRole("button", { name: "Send request" })).toBeDisabled();
  await page.getByLabel("Path", { exact: true }).fill("/items?limit=4");
  await expect(page.getByRole("button", { name: "Send request" })).toBeEnabled();
});
