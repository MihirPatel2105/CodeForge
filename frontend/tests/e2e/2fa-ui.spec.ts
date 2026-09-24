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

  const passkeyLink = page.getByRole("link", { name: "Manage passkeys" });
  await expect(passkeyLink).toBeVisible();
  await expect(passkeyLink).toHaveAttribute("href", "/profile/settings/passkeys");
  const twoFactorLink = page.getByRole("link", { name: "Set up 2FA" });
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
  await expect(page.getByText("Authenticator codes are off")).toBeVisible();

  await page.getByLabel("current password").fill("test-password");
  await page.getByRole("button", { name: "Continue securely" }).click();

  const setupDialog = page.getByRole("dialog", { name: "Add CodeForge to your app" });
  await expect(setupDialog).toBeVisible();
  await expect(setupDialog.getByRole("button", { name: "QR code" })).toHaveAttribute("aria-pressed", "true");
  const selector = setupDialog.getByRole("group", { name: "Authenticator setup method" });
  const selectorBox = await selector.boundingBox();
  const qrButtonBox = await selector.getByRole("button", { name: "QR code" }).boundingBox();
  expect(selectorBox).not.toBeNull();
  expect(qrButtonBox).not.toBeNull();
  expect(qrButtonBox!.y).toBeGreaterThanOrEqual(selectorBox!.y);
  expect(qrButtonBox!.y + qrButtonBox!.height).toBeLessThanOrEqual(selectorBox!.y + selectorBox!.height);
  await expect(setupDialog.getByRole("img", { name: "CodeForge two-factor setup QR code" })).toBeVisible();
  await expect(setupDialog.getByText("JBSWY3DPEHPK3PXP")).toBeHidden();

  await setupDialog.getByRole("button", { name: "Setup key", exact: true }).click();
  await expect(setupDialog.getByRole("button", { name: "Setup key", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(setupDialog.getByText("JBSWY3DPEHPK3PXP")).toBeVisible();
  await expect(setupDialog.getByRole("img", { name: "CodeForge two-factor setup QR code" })).toBeHidden();

  await setupDialog.getByRole("button", { name: "Continue to verification" }).click();
  const verificationDialog = page.getByRole("dialog", { name: "Verify your authenticator" });
  await expect(verificationDialog).toBeVisible();
  await expect(verificationDialog.getByLabel("six-digit authenticator code")).toBeVisible();
  await verificationDialog.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Continue verification" }).click();
  await expect(verificationDialog).toBeVisible();
  await verificationDialog.getByRole("button", { name: "Back to setup" }).click();
  await expect(setupDialog.getByText("JBSWY3DPEHPK3PXP")).toBeVisible();
  await setupDialog.getByRole("button", { name: "Continue to verification" }).click();

  await verificationDialog.getByLabel("six-digit authenticator code").fill("123456");
  const verifyRequest = page.waitForRequest((request) => request.url().endsWith("/auth/totp/verify") && request.method() === "POST");
  await verificationDialog.getByRole("button", { name: "Verify and enable 2FA" }).click();
  expect(JSON.parse((await verifyRequest).postData() ?? "null")).toEqual({ code: "123456" });
  await expect(page.getByText("Authenticator codes are on")).toBeVisible();
});
