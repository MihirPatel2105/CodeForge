import { expect, test, type Page } from "@playwright/test";

const user = { id: "arc-user", first_name: "Regular", last_name: "User", email: "user@example.com", is_admin: false, created_at: "2026-10-01T00:00:00Z" };
const runId = "arc-run";
async function session(page: Page) {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: user }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
  await page.route("**/api/backend/projects/overview*", route => route.fulfill({ json: { items: [], next_cursor: null, total_projects: 0, matching_projects: 0, total_runs: 0, total_succeeded: 0 } }));
}

test("account menu is keyboard accessible and sign-out failures preserve the session", async ({ page }) => {
  await session(page);
  await page.route("**/api/backend/auth/sign-out", route => route.fulfill({ status: 503, json: { error: { message: "private failure" } } }));
  await page.goto("/projects");
  const avatar = page.getByRole("button", { name: "Account menu, Regular User" });
  await avatar.focus();
  await avatar.press("ArrowDown");
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "Profile", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(avatar).toBeFocused();
  await avatar.click();
  await menu.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await expect(page.getByText("Couldn't confirm sign-out. Check your connection, then try again.")).toBeVisible();
  await expect(avatar).toBeVisible();
  await expect(page).toHaveURL(/\/projects$/);
  await avatar.click();
  await page.screenshot({ path: "/tmp/codeforge-user-menu.png" });
});

test("mobile account menu opens as a bottom sheet and can navigate to settings", async ({ page }) => {
  await session(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/projects");
  await page.getByRole("button", { name: "Account menu, Regular User" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toHaveCSS("position", "fixed");
  const box = await menu.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  await menu.getByRole("menuitem", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/profile\/settings$/);
});

test("JSON tree searches nested responses, copies paths, and keeps raw/non-JSON fallback", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await session(page);
  const payload = { items: [{ id: "book-1", title: "A sample book", available: true }], total: 1 };
  let body = JSON.stringify(payload);
  await page.route(`**/api/backend/runs/${runId}/preview`, route => route.fulfill({ json: { operations: [{ method: "GET", path: "/books", summary: "List books", has_body: false }], expires_after_seconds: 900, session_started: false } }));
  await page.route(`**/api/backend/runs/${runId}/preview/request`, route => route.fulfill({ json: { status: 200, body, content_type: "application/json", duration_ms: 3, session_started: false, truncated: false } }));
  await page.goto(`/runs/${runId}/try`);
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search JSON" }).fill("sample book");
  const tree = page.getByRole("tree", { name: "Response JSON" });
  await expect(tree.getByText('"A sample book"', { exact: true })).toBeVisible();
  await tree.getByRole("treeitem").filter({ hasText: "A sample book" }).click();
  await page.getByRole("button", { name: "Copy path", exact: true }).last().click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("response.items[0].title");
  await page.screenshot({ path: "/tmp/codeforge-json-tree.png" });
  await page.getByRole("button", { name: "Raw", exact: true }).click();
  await expect(page.locator("pre")).toHaveText(JSON.stringify(payload));
  body = "plain response <script>text only</script>";
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await expect(page.getByRole("tree")).toHaveCount(0);
  await expect(page.locator("pre")).toHaveText(body);
});

test("illustrated empty projects retain the real create-project action", async ({ page }) => {
  await session(page);
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Start your first API project" })).toBeVisible();
  await expect(page.locator('.cf-project-empty > svg[aria-hidden="true"]')).toBeVisible();
  await expect(page.locator('.cf-project-empty [data-slot="empty-header"] > svg')).toBeHidden();
  await page.screenshot({ path: "/tmp/codeforge-project-empty.png" });
  await page.locator(".cf-project-empty").getByRole("button", { name: "New project" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

for (const ambiguous of [false, true]) {
  test(`account menu ends a ${ambiguous ? "confirmed revoked" : "successful"} session`, async ({ page }) => {
    await session(page);
    let revoked = false;
    await page.route("**/api/backend/auth/me", route => route.fulfill({ status: revoked ? 401 : 200, json: revoked ? {} : user }));
    await page.route("**/api/backend/auth/sign-out", route => {
      revoked = true;
      return ambiguous ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ status: 204 });
    });
    await page.goto("/projects");
    await page.getByRole("button", { name: "Account menu, Regular User" }).click();
    await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => document.cookie)).not.toContain("codeforge_session_present=1");
  });
}
