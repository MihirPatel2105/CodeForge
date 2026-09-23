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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("codeforge_token", "ui-test-token"));
  await page.route("**/auth/me", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ADMIN) }));
});

test("dedicated 2FA page presents QR and manual enrollment paths", async ({ page }) => {
  await page.route("**/auth/totp/setup", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      secret: "JBSWY3DPEHPK3PXP",
      provisioning_uri: "otpauth://totp/CodeForge%3Aoperator%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=CodeForge&algorithm=SHA1&digits=6&period=30",
    }),
  }));
  await page.route("**/auth/totp/verify", (route) => route.fulfill({ status: 204 }));

  await page.goto("/admin/security/2fa");
  await expect(page.getByRole("heading", { level: 1, name: "Two-factor authentication" })).toBeVisible();
  await expect(page.getByText("Two-factor protection is off")).toBeVisible();

  await page.getByLabel("current password").fill("test-password");
  await page.getByRole("button", { name: "Continue securely" }).click();

  await expect(page.getByRole("heading", { name: "Scan QR code" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Enter setup key" })).toBeVisible();
  await expect(page.getByRole("img", { name: "CodeForge administrator two-factor setup QR code" })).toBeVisible();
  await expect(page.getByText("JBSWY3DPEHPK3PXP")).toBeVisible();

  await page.getByLabel("six-digit authenticator code").fill("123456");
  await page.getByRole("button", { name: "Verify and enable 2FA" }).click();
  await expect(page.getByText("Two-factor protection is active")).toBeVisible();
});
