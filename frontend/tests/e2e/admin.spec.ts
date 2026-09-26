import { expect, test } from "@playwright/test";

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.skip(!email || !password, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD.");

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
});

test("admin navigation exposes every operational surface", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Admin control centre" })).toBeVisible();
  for (const [path, heading] of [
    ["/admin/users", "Users"],
    ["/admin/runs", "Runs"],
    ["/admin/quality", "Quality"],
    ["/admin/system", "System health"],
    ["/admin/monitoring", "Monitoring"],
    ["/admin/audit", "Audit log"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
});

test("admin inventories are paginated, filterable, and exportable", async ({ page }) => {
  await page.goto("/admin/users");
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
  await expect(page.getByLabel("Users from date")).toBeVisible();
  await expect(page.getByText(/accounts · page \d+ of \d+/i)).toBeVisible();

  await page.goto("/admin/runs");
  await expect(page.getByLabel("Run status")).toBeVisible();
  await expect(page.getByLabel("Runs from date")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();

  await page.goto("/admin/audit");
  await expect(page.getByRole("textbox", { name: "Action" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
});

test("admin settings expose two-factor and protected-account controls", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: "Security", exact: true })).toHaveCount(0);

  await page.goto("/profile/settings");
  await expect(page.getByRole("heading", { name: "Admin settings" })).toBeVisible();
  await expect(page.getByRole("link", { name: /two-factor authentication/i })).toBeVisible();
  await expect(page.getByText("Administrator deletion is disabled")).toBeVisible();

  await page.getByRole("link", { name: /two-factor authentication/i }).click();
  await expect(page).toHaveURL(/\/profile\/settings\/2fa$/);
  await expect(page.getByRole("heading", { level: 1, name: "Two-factor authentication" })).toBeVisible();
  await expect(page.getByText(/authenticator codes are (on|off)/i)).toBeVisible();
});
