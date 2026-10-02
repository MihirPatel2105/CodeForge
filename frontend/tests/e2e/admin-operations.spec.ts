import { expect, test, type Page } from "@playwright/test";
const at = "2026-10-02T09:00:00Z";
const user = { id: "admin-user", email: "operator@example.com", first_name: "Operator", last_name: "", created_at: at, is_admin: true, email_verified: true, totp_enabled: true };
const run = { id: "old-run", project_id: "project", project_name: "Tasks", user_id: "owner", user_email: "owner@example.com", prompt: "Build a tasks API", status: "awaiting_approval", is_live: false, iterations: 0, acceptance_level: null, test_pass_ratio: null, provider_fallbacks: 0, end_to_end_ms: null, created_at: at, updated_at: at };
async function session(page: Page) {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: { error: { code: "not_found", message: "Unavailable" } } }));
  await page.route("**/api/backend/auth/admin-access", route => route.fulfill({ json: { allowed: true, expires_at: new Date(Date.now() + 3600000).toISOString() } }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: user }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
}

test("dedicated attention queue surfaces old approvals and refreshes while visible", async ({ page }) => {
  await session(page);
  await page.clock.install();
  await page.route("**/api/backend/admin/overview", route => route.fulfill({ json: { totals: { users: 2, projects: 1, runs: 1, active_runs: 1, awaiting_approval: 1, succeeded_runs: 0, failed_runs: 0, l5_runs: 0, runs_with_provider_fallbacks: 0 }, recent_runs: [] } }));
  await page.route("**/api/backend/admin/system-health", route => route.fulfill({ json: { checked_at: at, services: [], providers: [] } }));
  let checks = 0;
  await page.route("**/api/backend/admin/attention", route => { checks++; return route.fulfill({ json: { checked_at: at, total: 1, items: [{ run, priority: "urgent", reason: "Waiting for the project owner’s decision.", waiting_minutes: 120, guidance: null }] } }); });
  await page.goto("/admin");
  await expect(page.getByText("120 min since update")).toBeVisible();
  await expect(page.getByRole("link", { name: "Inspect run →" })).toHaveAttribute("href", "/admin/runs/old-run");
  await expect(page.getByRole("link", { name: "awaiting approval 1" })).toHaveAttribute("href", "/admin/runs?status=awaiting_approval");
  const before = checks;
  await page.clock.fastForward(61000);
  await expect.poll(() => checks).toBeGreaterThan(before);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: "/tmp/codeforge-admin-attention-mobile.png", fullPage: true });
});

test("hosting inventory requires a reviewed reason before stopping an API", async ({ page }) => {
  await session(page);
  let stopped = false;
  let reason = "";
  await page.route("**/api/backend/admin/deployments", route => route.fulfill({ json: { checked_at: at, capacity: 2, items: stopped ? [] : [{ id: "deployment", run_id: "old-run", project_id: "project", project_name: "Tasks", user_id: "owner", user_email: "owner@example.com", status: "active", created_at: at, runtime_status: "ready", started_at: at, memory_bytes: 104857600, memory_limit_bytes: 536870912, detail: "Runtime is running and its startup marker is present." }] } }));
  await page.route("**/api/backend/admin/deployments/deployment/stop", route => { reason = route.request().postDataJSON().reason; stopped = true; return route.fulfill({ json: { message: "Published API stopped and its runtime data removed." } }); });
  await page.goto("/admin/deployments");
  await expect(page.getByText("100.0 MB / 512 MB")).toBeVisible();
  await page.getByRole("button", { name: "Stop API", exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirm stop" })).toBeDisabled();
  await page.getByLabel("Reason", { exact: true }).fill("Owner requested cleanup");
  await page.getByRole("button", { name: "Confirm stop" }).click();
  await expect(page.getByText("No APIs are published.")).toBeVisible();
  expect(reason).toBe("Owner requested cleanup");
});

test("incident updates keep notes and allow resolving a grouped failure", async ({ page }) => {
  await session(page);
  let status = "open";
  const notes: { admin_email: string; text: string; at: string }[] = [];
  await page.route("**/api/backend/admin/incidents", route => route.fulfill({ json: { checked_at: at, items: [{ key: "failed_llm:2026-10-02", title: "Model request failures", count: 4, latest_at: at, sample_run_id: "old-run", status, notes }] } }));
  await page.route("**/api/backend/admin/incidents/*", route => { const body = route.request().postDataJSON(); status = body.status; notes.push({ admin_email: user.email, text: body.note, at }); return route.fulfill({ json: { message: "Incident updated." } }); });
  await page.goto("/admin/incidents");
  await expect(page.getByText("4 affected runs", { exact: false })).toBeVisible();
  await page.getByLabel("Status", { exact: true }).selectOption("acknowledged");
  await page.getByLabel("Internal note", { exact: true }).fill("Investigating provider limits");
  await page.getByRole("button", { name: "Save update" }).click();
  await expect(page.getByText("acknowledged", { exact: true })).toBeVisible();
  await page.getByLabel("Status", { exact: true }).selectOption("resolved");
  await page.getByLabel("Internal note", { exact: true }).fill("Provider is available again");
  await page.getByRole("button", { name: "Save update" }).click();
  await expect(page.getByText("No incidents in this view.")).toBeVisible();
  await page.getByRole("button", { name: "Resolved", exact: true }).click();
  await page.getByText("Internal notes (2)").click();
  await expect(page.getByText("Investigating provider limits")).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: "/tmp/codeforge-admin-incidents-mobile.png", fullPage: true });
});

test("run filters survive reload and mobile rows keep owner links", async ({ page }) => {
  await session(page);
  const queries: URLSearchParams[] = [];
  await page.route("**/api/backend/admin/runs?*", route => { queries.push(new URL(route.request().url()).searchParams); return route.fulfill({ json: { items: [run], pagination: { page: 1, page_size: 25, total: 1, pages: 1 } } }); });
  await page.goto("/admin/runs?status=awaiting_approval&user_id=owner&q=tasks");
  await expect(page.getByLabel("Run status")).toHaveValue("awaiting_approval");
  await expect(page.getByPlaceholder("Search run prompt")).toHaveValue("tasks");
  await expect.poll(() => queries.at(-1)?.get("user_id")).toBe("owner");
  await page.reload();
  await expect(page.getByPlaceholder("Search run prompt")).toHaveValue("tasks");
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("link", { name: "Inspect run old-run" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect.poll(() => queries.at(-1)?.get("user_id")).toBe(null);
});

test("period comparison refreshes metrics when the window changes", async ({ page }) => {
  await session(page);
  await page.route("**/api/backend/admin/monitoring?*", route => route.fulfill({ json: { days: 30, daily: [], providers: [], alerts: [], total_storage_bytes: 0, total_tokens: 0, failure_rate: 0, estimated_cost_usd: 0 } }));
  const days: string[] = [];
  await page.route("**/api/backend/admin/trends?*", route => { const value = new URL(route.request().url()).searchParams.get("days")!; days.push(value); return route.fulfill({ json: { checked_at: at, days: Number(value), current: { runs: 10, failed: 1, succeeded: 9, tokens: 200 }, previous: { runs: 5, failed: 2, succeeded: 3, tokens: 100 } } }); });
  await page.goto("/admin/monitoring");
  await expect(page.getByText("+5 · previous 5")).toBeVisible();
  await page.getByRole("combobox").selectOption("7");
  await expect(page.getByRole("heading", { name: "Last 7 days versus the previous 7" })).toBeVisible();
  await expect.poll(() => days.at(-1)).toBe("7");
});
