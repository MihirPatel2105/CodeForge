import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Asia/Kolkata" });

test("project cards and run history use the viewer's local time", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("codeforge_token", "ui-test-token"));
  await page.route("http://localhost:8000/auth/me", (route) => route.fulfill({
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
  ];

  await page.route("http://localhost:8000/projects", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(projects) }));
  for (const project of projects) {
    await page.route(`http://localhost:8000/projects/${project.id}`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(project) }));
    await page.route(`http://localhost:8000/projects/${project.id}/runs`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(runs.filter((run) => run.project_id === project.id)) }));
  }

  await page.goto("/projects");
  await expect(page.locator('a[href="/projects/project-1"]')).toContainText("Sep 24, 14:09");
  await expect(page.locator('a[href="/projects/project-2"]')).toContainText("Sep 25, 02:39");

  await page.locator('a[href="/projects/project-2"]').click();
  await expect(page.getByText("Sep 25, 02:39")).toBeVisible();
});
