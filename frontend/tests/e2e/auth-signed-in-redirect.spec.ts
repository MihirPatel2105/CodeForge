import { expect, test, type Page } from "@playwright/test";

// A signed-in user who opens /login or /signup goes straight to their workspace. The browser-
// visible session flag can outlive the real session, so the server confirms it first: a stale
// flag is cleared and the form stays, which also rules out a /login <-> /projects loop.
async function withSession(page: Page, me: { status: number; isAdmin?: boolean }) {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", (route) => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/projects**", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/backend/runs/attention", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/backend/auth/me", (route) => me.status === 200
    ? route.fulfill({ json: { id: "u", email: "member@example.com", first_name: "Member", is_admin: Boolean(me.isAdmin), created_at: "2026-10-01T09:00:00Z" } })
    : route.fulfill({ status: me.status, json: { error: { code: "not_authenticated", message: "Sign in again." } } }));
}

for (const path of ["/login", "/signup"]) {
  test(`a signed-in member opening ${path} lands on their projects`, async ({ page }) => {
    await withSession(page, { status: 200 });
    await page.goto(path);
    await expect(page).toHaveURL(/\/projects$/);
  });
}

test("a signed-in admin opening /login lands on the admin console", async ({ page }) => {
  await withSession(page, { status: 200, isAdmin: true });
  await page.goto("/login");
  await expect(page).toHaveURL(/\/admin$/);
});

test("a stale session flag is cleared and the sign-in form stays", async ({ page }) => {
  await withSession(page, { status: 401 });
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.cookie.includes("codeforge_session_present=1"))).toBe(false);
  await expect(page).toHaveURL(/\/login$/);
});

test("without any session the form shows and the server is not asked", async ({ page }) => {
  let asked = false;
  await page.route("**/api/backend/auth/me", (route) => { asked = true; return route.fulfill({ status: 401, json: {} }); });
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  expect(asked).toBe(false);
});
