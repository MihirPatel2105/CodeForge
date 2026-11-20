import { expect, test } from "@playwright/test";

const me = (totp_enabled: boolean) => ({
  id: "password-user", email: "user@example.com", first_name: "Regular", last_name: "User",
  created_at: "2026-09-23T00:00:00Z", is_admin: false, email_verified: true, totp_enabled,
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => document.cookie = "codeforge_session_present=1; Path=/");
});

test("a successful password change stays on screen and confirms it", async ({ page }) => {
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: me(false) }));
  await page.route("**/api/backend/auth/change-password", route =>
    route.fulfill({ json: { access_token: "browser-session", token_type: "bearer" } }));
  await page.goto("/profile/settings/password");

  await page.getByLabel("Current password").fill("OldPassword123");
  await page.getByLabel("New password", { exact: true }).fill("NewPassword123");
  await expect(page.getByLabel("Authenticator code")).toHaveCount(0);
  await page.getByRole("button", { name: "Change password" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Password changed" })).toBeVisible();
});

test("password change asks for the authenticator code when 2FA is on", async ({ page }) => {
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: me(true) }));
  let sent: unknown = null;
  await page.route("**/api/backend/auth/change-password", route => {
    sent = route.request().postDataJSON();
    return route.fulfill({ status: 401, json: { error: { code: "unauthorized", message: "No" } } });
  });
  await page.goto("/profile/settings/password");

  const submit = page.getByRole("button", { name: "Change password" });
  await page.getByLabel("Current password").fill("OldPassword123");
  await page.getByLabel("New password", { exact: true }).fill("NewPassword123");
  await expect(submit).toBeDisabled();
  await page.getByLabel("Authenticator code").fill("123 456");
  await submit.click();

  await expect(page.getByText("current password or authenticator code is not correct")).toBeVisible();
  expect(sent).toEqual({ current_password: "OldPassword123", new_password: "NewPassword123", totp_code: "123456" });
});
