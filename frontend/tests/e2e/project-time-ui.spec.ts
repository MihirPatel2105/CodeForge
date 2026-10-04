import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Asia/Kolkata" });

test("project cards and run history use the viewer's local time", async ({ page }) => {
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
    { id: "project-1", name: "Offset timestamp", description: "", created_at: "2026-09-24T08:39:14Z" },
    { id: "project-2", name: "Legacy timestamp", description: "", created_at: "2026-09-24T21:09:14" },
  ];
  const runs = [
    { id: "run-1", project_id: "project-1", prompt: "Build an API", status: "succeeded", iterations: 1, created_at: "2026-09-24T08:39:14Z", updated_at: "2026-09-24T08:40:00Z" },
    { id: "run-2", project_id: "project-2", prompt: "Build another API", status: "succeeded", iterations: 1, created_at: "2026-09-24T21:09:14", updated_at: "2026-09-24T21:10:00" },
    { id: "run-3", project_id: "project-2", prompt: "More history", status: "failed_llm", iterations: 2, created_at: "2026-09-23T21:09:14", updated_at: "2026-09-23T21:10:00" },
  ];

  await page.route("**/api/backend/projects/overview*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    items: projects.map((project) => ({ ...project, recent_runs: runs.filter((run) => run.project_id === project.id), stats: { total: 1, succeeded: 1, failed: 0, active: 0, avg_loops: 1, last: runs.find((run) => run.project_id === project.id) } })),
    next_cursor: null, total_projects: 2, matching_projects: 2, total_runs: 2, total_succeeded: 2,
  }) }));
  let pendingFirstPages = 0;
  for (const project of projects) {
    await page.route(`**/api/backend/projects/${project.id}`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(project) }));
    await page.route(`**/api/backend/projects/${project.id}/runs`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(runs.filter((run) => run.project_id === project.id)) }));
    await page.route(`**/api/backend/projects/${project.id}/runs/page*`, async (route) => {
      const projectRuns = runs.filter((run) => run.project_id === project.id);
      const olderPage = new URL(route.request().url()).searchParams.has("cursor");
      // Slow first-page responses expose a late refresh overwriting appended history.
      if (project.id === "project-2" && !olderPage) {
        pendingFirstPages += 1;
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: project.id === "project-2" ? [projectRuns[olderPage ? 1 : 0]] : projectRuns, next_cursor: project.id === "project-2" && !olderPage ? "run-2" : null, stats: { total: projectRuns.length, succeeded: 1, failed: projectRuns.length - 1, active: 0, avg_loops: 1, last: projectRuns[0] } }) });
      if (project.id === "project-2" && !olderPage) pendingFirstPages -= 1;
    });
  }

  await page.goto("/projects");
  await expect(page.locator('a[href="/projects/project-1"]')).toContainText("Sep 24, 14:09");
  await expect(page.locator('a[href="/projects/project-2"]')).toContainText("Sep 25, 02:39");

  await page.locator('a[href="/projects/project-2"]').click();
  await expect(page.getByText("Sep 25, 02:39")).toBeVisible();
  await expect(page.getByText("1 of 2 runs")).toBeVisible();
  await page.getByRole("button", { name: "Load more runs" }).click();
  await expect(page.getByText("More history")).toBeVisible();
  await expect.poll(() => pendingFirstPages).toBe(0);
  await expect(page.getByText("More history")).toBeVisible();
  await expect(page.getByText("2 of 2 runs")).toBeVisible();
});
