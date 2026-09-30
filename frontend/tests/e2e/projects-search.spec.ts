import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 } });

test("project search filters names and descriptions without changing portfolio totals", async ({ page }) => {
  await page.addInitScript(() => document.cookie = "codeforge_session_present=1; Path=/");
  await page.route("**/api/backend/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      id: "507f1f77bcf86cd799439012",
      email: "user@example.com",
      first_name: "Regular",
      last_name: "User",
      created_at: "2026-09-23T00:00:00Z",
      is_admin: false,
      email_verified: true,
      totp_enabled: false,
    }),
  }));

  const projects = [
    { id: "project-1", name: "Book Collection", description: "Library catalogue API", created_at: "2026-09-24T08:39:14Z" },
    { id: "project-2", name: "Contact Directory", description: "Store phone numbers", created_at: "2026-09-25T08:39:14Z" },
  ];
  await page.route("**/api/backend/projects/overview*", (route) => {
    const query = new URL(route.request().url()).searchParams.get("q")?.toLowerCase() ?? "";
    const matching = projects.filter((project) => `${project.name} ${project.description}`.toLowerCase().includes(query));
    return route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify({
        items: matching.map((project) => ({ ...project, recent_runs: [], stats: { total: 0, succeeded: 0, failed: 0, active: 0, avg_loops: null, last: null } })),
        next_cursor: null, total_projects: 2, matching_projects: matching.length, total_runs: 0, total_succeeded: 0,
      }),
    });
  });

  await page.goto("/projects");
  const search = page.getByRole("searchbox", { name: "Search projects" });
  await expect(page.locator('a[href="/projects/project-1"]')).toBeVisible();
  await expect(page.locator('a[href="/projects/project-2"]')).toBeVisible();
  await expect(page.locator("main dl").getByText("2", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await search.focus();
  await page.keyboard.type("LIBRARY");
  await expect(page.locator('a[href="/projects/project-1"]')).toBeVisible();
  await expect(page.locator('a[href="/projects/project-2"]')).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("1 of 1 matching projects shown");
  await expect(page.locator("main dl").getByText("2", { exact: true })).toBeVisible();

  await search.fill("missing");
  await expect(page.getByRole("heading", { name: "No matching projects" })).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(search).toHaveValue("");
  await expect(page.locator('a[href="/projects/project-2"]')).toBeVisible();
});
