import { expect, test } from "@playwright/test";

test("profile recovers activity and exposes two-factor settings", async ({ page }) => {
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

  let requests = 0;
  await page.route("http://localhost:8000/projects", (route) => {
    requests += 1;
    return route.fulfill({
      status: requests === 1 ? 500 : 200,
      contentType: "application/json",
      body: requests === 1 ? JSON.stringify({ error: { code: "server_error", message: "Unavailable" } }) : "[]",
    });
  });

  await page.goto("/profile");
  await expect(page.getByText("Couldn't load your activity.")).toBeVisible();
  await page.getByRole("button", { name: "Retry activity" }).click();
  await expect(page.getByText("Couldn't load your activity.")).toHaveCount(0);
  await expect(page.locator('dl[aria-label="Activity summary"]')).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("link", { name: /two-factor authentication/i })).toHaveAttribute("href", "/profile/settings/2fa");
  await expect(page.getByText("Off", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("heading", { level: 1, name: "Regular User" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  expect(requests).toBe(2);
});
