import { expect, test } from "@playwright/test";

test("profile recovers activity and exposes two-factor settings", async ({ page }) => {
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
      body: requests === 1 ? JSON.stringify({ error: { code: "server_error", message: "Unavailable" } }) : "[]",
    });
  });

  await page.goto("/profile");
  await expect(page.getByText("Couldn't load your activity.")).toBeVisible();
  await page.getByRole("button", { name: "Retry activity" }).click();
  await expect(page.getByText("Couldn't load your activity.")).toHaveCount(0);
  await expect(page.locator('dl[aria-label="Activity summary"]')).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("link", { name: "Settings", exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: /two-factor authentication/i })).toHaveCount(0);
  await expect(page.getByText("Off", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("heading", { level: 1, name: "Regular User" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  expect(requests).toBe(2);

  await page.route("**/api/backend/auth/devices", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/profile\/settings$/);
  await expect(page.getByRole("link", { name: "Set up 2FA", exact: true })).toHaveAttribute("href", "/profile/settings/2fa");
  await page.getByRole("link", { name: "Set up 2FA", exact: true }).click();
  await expect(page).toHaveURL(/\/profile\/settings\/2fa$/);
});

test("sign out finishes on the first click when the server revoked the session but the response failed", async ({ page }) => {
  await page.addInitScript(() => document.cookie = "codeforge_session_present=1; Path=/");
  let revoked = false;
  let signOutRequests = 0;
  await page.route("**/api/backend/auth/me", (route) => route.fulfill({
    status: revoked ? 401 : 200,
    contentType: "application/json",
    body: revoked
      ? JSON.stringify({ error: { code: "unauthorized", message: "Unauthorized" } })
      : JSON.stringify({ id: "user-1", email: "user@example.com", first_name: "Regular", last_name: "User", created_at: "2026-09-23T00:00:00Z", is_admin: false, email_verified: true, totp_enabled: false }),
  }));
  await page.route("**/api/backend/auth/devices", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/api/backend/auth/sign-out", (route) => {
    signOutRequests += 1;
    revoked = true;
    return route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: { code: "service_unavailable", message: "Unavailable" } }) });
  });

  await page.goto("/profile/settings");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(signOutRequests).toBe(1);
  expect(await page.evaluate(() => document.cookie.includes("codeforge_session_present=1"))).toBe(false);
});
