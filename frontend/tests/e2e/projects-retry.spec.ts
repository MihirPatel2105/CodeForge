import { expect, test } from "@playwright/test";

test("projects replaces a failed load with an actionable retry", async ({ page }) => {
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

  let requests = 0;
  await page.route("**/api/backend/projects", (route) => {
    requests += 1;
    return route.fulfill({
      status: requests === 1 ? 500 : 200,
      contentType: "application/json",
      body: requests === 1
        ? JSON.stringify({ error: { code: "server_error", message: "Temporarily unavailable" } })
        : "[]",
    });
  });

  await page.goto("/projects");
  await expect(page.locator("main [role=alert]")).toBeVisible();
  await expect(page.getByLabel("Loading projects")).toHaveCount(0);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Start your first API project" })).toBeVisible();
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
  expect(requests).toBe(2);
});
