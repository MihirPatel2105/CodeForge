import { expect, test } from "@playwright/test";

for (const width of [375, 1280]) {
  test(`new account follows the guided first run at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    const email = "new@example.com";
    const project = { id: "project-1", name: "Book API", description: "", created_at: "2026-09-30T00:00:00Z" };
    let created = false;

    await page.route("**/api/backend/auth/register", (route) => route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ verification_required: true, email, expires_at: new Date(Date.now() + 600_000).toISOString() }),
    }));
    await page.route("**/api/backend/auth/verify-email", (route) => route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify({ access_token: "new-session", token_type: "bearer" }),
    }));
    await page.route("**/api/backend/auth/me", (route) => route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ id: "user-1", email, first_name: "New", last_name: "", created_at: "2026-09-30T00:00:00Z", is_admin: false, email_verified: true, totp_enabled: false }),
    }));
    await page.route("**/api/backend/projects/overview*", (route) => route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ items: created ? [{ ...project, recent_runs: [], stats: { total: 0, succeeded: 0, failed: 0, active: 0, avg_loops: null, last: null } }] : [], next_cursor: null, total_projects: created ? 1 : 0, matching_projects: created ? 1 : 0, total_runs: 0, total_succeeded: 0 }),
    }));
    await page.route("**/api/backend/projects", (route) => {
      created = true;
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(project) });
    });
    await page.route("**/api/backend/projects/project-1", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(project) }));
    await page.route("**/api/backend/projects/project-1/runs/page*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], next_cursor: null, stats: { total: 0, succeeded: 0, failed: 0, active: 0, avg_loops: null, last: null } }) }));
    await page.route("**/api/backend/runs", (route) => route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ run_id: "run-1", status: "running" }) }));
    await page.route("**/api/backend/runs/run-1", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "run-1", project_id: project.id, prompt: "Build a CRUD API for books", status: "running", state: {}, metrics: null, created_at: project.created_at, updated_at: project.created_at }) }));
    await page.route("**/api/backend/runs/run-1/stream", (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body: ": waiting\n\n" }));

    await page.goto("/signup");
    await page.getByLabel("First name").fill("New");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("Strongpass1");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await page.getByRole("group", { name: "Verification code" }).getByRole("textbox").first().fill("123456");

    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.locator('[data-tour-step="1"]')).toContainText("Your work starts here");
    await page.locator('[data-tour-step="1"]').getByRole("button", { name: "Next" }).click();
    await expect(page.locator('[data-tour-step="2"]')).toContainText("Create a project");
    if (width === 375) await page.locator('[data-tour-step="2"]').getByRole("button", { name: "New project" }).click();
    else await page.locator('[data-tour="new-project"]').click();
    await expect(page.getByText("Start with a name.")).toBeVisible();
    await page.getByLabel("Name", { exact: true }).fill(project.name);
    await page.getByRole("button", { name: "Create project" }).click();

    await expect(page.locator('[data-tour-step="3"]')).toContainText("Open your project");
    if (width === 375) await page.locator('[data-tour-step="3"]').getByRole("button", { name: "Open project" }).click();
    else await page.locator('[data-tour="created-project"]').click();
    await expect(page.locator('[data-tour-step="4"]')).toContainText("Describe your API");
    await page.getByLabel("Describe the API").fill("Build a CRUD API for books");
    await page.locator('[data-tour-step="4"]').getByRole("button", { name: "Next" }).click();
    await expect(page.locator('[data-tour-step="5"]')).toContainText("Start the run");
    await page.getByRole("button", { name: "Start run" }).click();

    await expect(page).toHaveURL(/\/runs\/run-1$/);
    await expect(page.locator('[data-tour-step="6"]')).toContainText("Watch the agents work");
    await page.locator('[data-tour-step="6"]').getByRole("button", { name: "Finish tour" }).click();
    await expect(page.locator("[data-tour-step]")).toHaveCount(0);
    expect(await page.evaluate((value) => localStorage.getItem(`codeforge:first-use:v1:${value}`), email)).toBe("done");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.getByRole("button", { name: "Start guided tour" }).click();
    await expect(page.locator('[data-tour-step="1"]')).toBeVisible();
    await page.locator('[data-tour-step="1"]').getByRole("button", { name: "Skip tour" }).click();
    await expect(page.locator("[data-tour-step]")).toHaveCount(0);
  });
}

test("new account starts the guide when email verification is disabled", async ({ page }) => {
  await page.route("**/api/backend/auth/register", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ verification_required: false, email: "new@example.com", access_token: "new-session", expires_at: null }),
  }));
  await page.route("**/api/backend/auth/me", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ id: "user-1", email: "new@example.com", first_name: "New", last_name: "", created_at: "2026-09-30T00:00:00Z", is_admin: false, email_verified: true, totp_enabled: false }),
  }));
  await page.route("**/api/backend/projects/overview*", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ items: [], next_cursor: null, total_projects: 0, matching_projects: 0, total_runs: 0, total_succeeded: 0 }),
  }));
  await page.goto("/signup");
  await page.getByLabel("First name").fill("New");
  await page.getByLabel("Email").fill("new@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Strongpass1");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.locator('[data-tour-step="1"]')).toContainText("Your work starts here");
});
