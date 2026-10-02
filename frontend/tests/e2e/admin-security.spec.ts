import { expect, test, type Page } from "@playwright/test";

async function session(page: Page) {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: { error: { code: "not_found" } } }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "operator", email: "operator@example.com", first_name: "Operator", is_admin: true, totp_enabled: true } }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
}

test("locked admin never mounts or requests operational data", async ({ page }) => {
  await session(page);
  let reads = 0;
  await page.route("**/api/backend/admin/**", route => { reads++; return route.fulfill({ json: {} }); });
  await page.route("**/api/backend/auth/admin-access", route => route.fulfill({ json: { allowed: false, expires_at: null } }));
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Admin access is locked" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in securely →" })).toHaveAttribute("href", "/login");
  expect(reads).toBe(0);
});

test("recent admin access locks when its absolute deadline expires", async ({ page }) => {
  await session(page);
  await page.clock.install();
  const expires = new Date(Date.now() + 10000).toISOString();
  await page.route("**/api/backend/auth/admin-access", route => route.fulfill({ json: { allowed: true, expires_at: expires } }));
  await page.route("**/api/backend/admin/incidents", route => route.fulfill({ json: { checked_at: new Date().toISOString(), items: [] } }));
  await page.goto("/admin/incidents");
  await expect(page.getByRole("heading", { name: "Incidents", exact: true })).toBeVisible();
  await page.clock.fastForward(11000);
  await expect(page.getByRole("heading", { name: "Admin access is locked" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Incidents", exact: true })).toHaveCount(0);
});

test("backend expiry removes admin content without trusting the client role", async ({ page }) => {
  await session(page);
  await page.route("**/api/backend/auth/admin-access", route => route.fulfill({ json: { allowed: true, expires_at: new Date(Date.now() + 3600000).toISOString() } }));
  let expired = false;
  await page.route("**/api/backend/admin/incidents", route => route.fulfill(expired ? { status: 403, json: { error: { code: "admin_verification_required" } } } : { json: { checked_at: new Date().toISOString(), items: [] } }));
  await page.goto("/admin/incidents");
  await expect(page.getByText("No incidents in this view.")).toBeVisible();
  expired = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Admin access is locked" })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/incidents$/);
});
