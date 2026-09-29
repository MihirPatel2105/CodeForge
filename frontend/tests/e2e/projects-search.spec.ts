import { expect, test } from "@playwright/test";

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
  await page.route("**/api/backend/projects", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(projects),
  }));
  await page.route("**/api/backend/projects/*/runs", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: "[]",
  }));

  await page.goto("/projects");
  const search = page.getByRole("searchbox", { name: "Search projects" });
  await expect(page.locator('a[href="/projects/project-1"]')).toBeVisible();
  await expect(page.locator('a[href="/projects/project-2"]')).toBeVisible();
  await expect(page.locator("main dl").getByText("2", { exact: true })).toBeVisible();

  await search.fill("LIBRARY");
  await expect(page.locator('a[href="/projects/project-1"]')).toBeVisible();
  await expect(page.locator('a[href="/projects/project-2"]')).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("1 of 2 projects");
  await expect(page.locator("main dl").getByText("2", { exact: true })).toBeVisible();

  await search.fill("missing");
  await expect(page.getByRole("heading", { name: "No matching projects" })).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(search).toHaveValue("");
  await expect(page.locator('a[href="/projects/project-2"]')).toBeVisible();
});
