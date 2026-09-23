import { expect, test } from "@playwright/test";

const ADMIN = {
  id: "507f1f77bcf86cd799439011",
  email: "operator@example.com",
  first_name: "CodeForge",
  last_name: "Admin",
  created_at: "2026-09-23T00:00:00Z",
  is_admin: true,
  email_verified: true,
  totp_enabled: false,
};

const USER = {
  ...ADMIN,
  id: "507f1f77bcf86cd799439012",
  email: "user@example.com",
  first_name: "Regular",
  last_name: "User",
  is_admin: false,
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("codeforge_token", "ui-test-token"));
  await page.route("**/auth/me", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ADMIN) }));
});

test("settings owns the 2FA entry instead of the admin navigation", async ({ page }) => {
  await page.goto("/profile/settings");

  const twoFactorLink = page.getByRole("link", { name: "Set up two-factor authentication" });
  await expect(twoFactorLink).toBeVisible();
  await expect(twoFactorLink).toHaveAttribute("href", "/profile/settings/2fa");
  await expect(page.getByText("Administrator deletion is disabled")).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByRole("navigation", { name: "Admin navigation" }).getByRole("link", { name: "Security", exact: true })).toHaveCount(0);
});

test("normal users can open 2FA settings and use QR or manual enrollment", async ({ page }) => {
  await page.unroute("**/auth/me");
  await page.route("**/auth/me", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(USER) }));
  await page.route("**/auth/totp/setup", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      secret: "JBSWY3DPEHPK3PXP",
      provisioning_uri: "otpauth://totp/CodeForge%3Auser%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=CodeForge&algorithm=SHA1&digits=6&period=30",
    }),
  }));
  await page.route("**/auth/totp/verify", (route) => route.fulfill({ status: 204 }));

  await page.goto("/profile/settings/2fa");
  await expect(page.getByRole("heading", { level: 1, name: "Two-factor authentication" })).toBeVisible();
  await expect(page.getByText("account security")).toBeVisible();
  await expect(page.getByText("Two-factor protection is off")).toBeVisible();

  await page.getByLabel("current password").fill("test-password");
  await page.getByRole("button", { name: "Continue securely" }).click();

  await expect(page.getByRole("heading", { name: "Scan QR code" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Enter setup key" })).toBeVisible();
  await expect(page.getByRole("img", { name: "CodeForge two-factor setup QR code" })).toBeVisible();
  await expect(page.getByText("JBSWY3DPEHPK3PXP")).toBeVisible();

  await page.getByLabel("six-digit authenticator code").fill("123456");
  await page.getByRole("button", { name: "Verify and enable 2FA" }).click();
  await expect(page.getByText("Two-factor protection is active")).toBeVisible();
});
