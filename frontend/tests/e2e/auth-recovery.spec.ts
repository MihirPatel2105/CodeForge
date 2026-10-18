import { expect, test } from "@playwright/test";

test("forgot-password request keeps the account-neutral confirmation", async ({ page }) => {
  let requestedEmail: string | null = null;
  await page.route("**/auth/forgot-password", async (route) => {
    requestedEmail = route.request().postDataJSON().email;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "If an account exists, a link was sent." }) });
  });

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("person@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();

  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  await expect(page.getByText("If that address has an account, a reset link is on its way.", { exact: false })).toBeVisible();
  expect(requestedEmail).toBe("person@example.com");
});

test("reset link submits the token and matching new password", async ({ page }) => {
  await page.route("**/api/backend/projects", route => route.fulfill({ json: [] }));
  await page.route("**/api/backend/projects/overview*", route => route.fulfill({ json: {
    items: [], next_cursor: null, total_projects: 0, matching_projects: 0,
    total_runs: 0, total_succeeded: 0,
  } }));
  let resetBody: { token: string; new_password: string } | null = null;
  await page.route("**/auth/reset-password", async (route) => {
    resetBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: "new-session", token_type: "bearer" }) });
  });
  await page.route("**/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ id: "507f1f77bcf86cd799439012", email: "person@example.com", first_name: "Person", last_name: "Example", created_at: "2026-09-23T00:00:00Z", is_admin: false, email_verified: true, totp_enabled: false }),
  }));

  await page.goto("/reset-password/test-link-token");
  await page.getByLabel("New password", { exact: true }).fill("Strongpass1");
  await page.getByLabel("Confirm new password", { exact: true }).fill("Strongpass1");
  await page.getByRole("button", { name: "Save new password" }).click();

  await expect(page).toHaveURL(/\/projects$/);
  expect(resetBody).toEqual({ token: "test-link-token", new_password: "Strongpass1" });
  expect(await page.evaluate(() => localStorage.getItem("codeforge_token"))).toBeNull();
});

test("reset on an MFA account verifies the authenticator before opening projects", async ({ page }) => {
  await page.route("**/auth/reset-password", route => route.fulfill({ json: {
    access_token: null, mfa_required: true, mfa_ticket: "reset-mfa-ticket",
    mfa_methods: ["totp", "recovery_code"],
  } }));
  let completion: unknown = null;
  await page.route("**/auth/login/complete", async route => {
    completion = route.request().postDataJSON();
    await route.fulfill({ json: { access_token: "browser-session", token_type: "bearer" } });
  });
  await page.route("**/auth/me", route => route.fulfill({ json: {
    id: "507f1f77bcf86cd799439012", email: "person@example.com", first_name: "Person",
    last_name: "Example", created_at: "2026-09-23T00:00:00Z", is_admin: false,
    email_verified: true, totp_enabled: true,
  } }));
  await page.route("**/api/backend/projects", route => route.fulfill({ json: [] }));
  await page.route("**/api/backend/projects/overview*", route => route.fulfill({ json: {
    items: [], next_cursor: null, total_projects: 0, matching_projects: 0,
    total_runs: 0, total_succeeded: 0,
  } }));
  await page.goto("/reset-password/test-mfa-reset");
  await page.getByLabel("New password", { exact: true }).fill("Strongpass1");
  await page.getByLabel("Confirm new password", { exact: true }).fill("Strongpass1");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/login\/verify$/);
  await expect(page.getByRole("heading", { name: "Verify yourself" })).toBeVisible();
  expect(completion).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("codeforge_token"))).toBeNull();
  await page.getByLabel("Authenticator code").fill("123456");
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  expect(completion).toEqual({ ticket: "reset-mfa-ticket", totp_code: "123456" });
});
