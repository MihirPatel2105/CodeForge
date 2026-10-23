import { expect, test } from "@playwright/test";

for (const width of [1440, 375]) {
  test(`recover authenticator and save backup codes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/backend/**", route => route.fulfill({ status: 401, json: {} }));
    await page.route("**/api/backend/auth/mfa-recovery/request", async route => {
      expect(route.request().postDataJSON()).toEqual({ email: "member@example.com" });
      await route.fulfill({ json: { message: "Request received" } });
    });
    await page.goto("/recover-2fa");
    await page.getByLabel("Email", { exact: true }).fill("member@example.com");
    await page.getByRole("button", { name: "Request recovery review" }).click();
    await expect(page.getByRole("heading", { name: "Request received" })).toBeVisible();
    const token = "email-token-for-recovery-preview-only";
    const setupToken = "restricted-setup-token-preview-only";
    await page.route("**/api/backend/auth/mfa-recovery/verify", async route => {
      expect(route.request().postDataJSON()).toEqual({ token, password: "Password123", recovery_code: "BACKUP-CODE" });
      await route.fulfill({ json: { setup_token: setupToken, secret: "JBSWY3DPEHPK3PXP", provisioning_uri: "otpauth://totp/CodeForge:preview?secret=JBSWY3DPEHPK3PXP&issuer=CodeForge" } });
    });
    await page.route("**/api/backend/auth/mfa-recovery/complete", async route => {
      expect(route.request().postDataJSON()).toEqual({ setup_token: setupToken, code: "123456" });
      await route.fulfill({ json: { codes: ["NEW-CODE-ONE", "NEW-CODE-TWO"], message: "Complete" } });
    });
    await page.goto(`/recover-2fa/${token}`);
    await page.getByLabel("Password", { exact: true }).fill("Password123");
    await page.getByLabel("Unused recovery code").fill("BACKUP-CODE");
    await page.getByRole("button", { name: "Verify recovery details" }).click();
    await expect(page.getByRole("heading", { name: "Connect your new authenticator" })).toBeVisible();
    await page.getByLabel("New authenticator code").fill("123456");
    await page.getByRole("button", { name: "Confirm new authenticator" }).click();
    await expect(page.getByLabel("New recovery codes")).toContainText("NEW-CODE-ONE");
    await expect(page.getByRole("link", { name: "I saved my codes — sign in" })).toHaveAttribute("href", "/login");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `/tmp/codeforge-mfa-recovery-${width}.png`, fullPage: true });
  });
}

test("admin must confirm password and reason before sending the recovery email", async ({ page }) => {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/admin-access", route => route.fulfill({ json: { allowed: true, expires_at: new Date(Date.now() + 3600000).toISOString() } }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "operator", email: "operator@example.com", first_name: "Operator", is_admin: true } }));
  let reviewed = false;
  await page.route("**/api/backend/admin/mfa-recovery", route => route.fulfill({ json: { items: reviewed ? [] : [{ id: "request-one", email: "member@example.com", created_at: "2026-10-23T10:00:00Z" }] } }));
  await page.route("**/api/backend/admin/mfa-recovery/request-one/review", async route => {
    expect(route.request().postDataJSON()).toEqual({ approve: true, current_password: "AdminPassword123", reason: "Reviewed recovery request" });
    reviewed = true;
    await route.fulfill({ json: { message: "Recovery email sent to the registered address." } });
  });
  await page.goto("/admin/recovery");
  await page.getByRole("button", { name: "Review request", exact: true }).click();
  const approve = page.getByRole("button", { name: "Approve & send link" });
  await expect(approve).toBeDisabled();
  await page.getByLabel("Review reason").fill("Reviewed recovery request");
  await page.getByLabel("Your admin password").fill("AdminPassword123");
  await approve.click();
  await expect(page.getByText("Recovery email sent to the registered address.", { exact: true })).toBeVisible();
  await expect(page.getByText("No pending recovery requests.")).toBeVisible();
});

test("invalid recovery proof keeps the user on the form", async ({ page }) => {
  await page.route("**/api/backend/**", route => route.fulfill({ status: 401, json: {} }));
  await page.goto("/recover-2fa/invalid-link-with-enough-length");
  await page.getByLabel("Password", { exact: true }).fill("Password123");
  await page.getByLabel("Unused recovery code").fill("WRONG");
  await page.getByRole("button", { name: "Verify recovery details" }).click();
  await expect(page.getByRole("region", { name: "Recover two-factor access" }).getByRole("alert")).toContainText("invalid, expired, or already used");
  await expect(page.getByLabel("Unused recovery code")).toBeVisible();
});
