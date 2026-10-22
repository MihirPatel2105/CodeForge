import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => document.cookie = "codeforge_session_present=1; Path=/");
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: {
    id: "deletion-user", email: "user@example.com", first_name: "Regular", last_name: "User",
    created_at: "2026-09-23T00:00:00Z", is_admin: false, email_verified: true, totp_enabled: false,
  } }));
  await page.route("**/api/backend/auth/devices", route => route.fulfill({ json: [] }));
});

for (const width of [1440, 375]) {
  test(`account deletion keeps password and typed confirmation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 375 ? 480 : 1000 });
    let accountRequests = 0;
    await page.route("**/api/backend/auth/delete-account", route => {
      accountRequests++;
      expect(route.request().postDataJSON()).toEqual({ password: "TestPassword123", confirmation: "DELETE" });
      return route.fulfill({ status: 500, json: { error: { code: "server_error", message: "Unavailable" } } });
    });
    await page.goto("/profile/settings");
    await page.getByRole("button", { name: "Delete account", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Delete your account" });
    await expect(dialog).toBeVisible();
    const lockedScroll = await page.evaluate(() => scrollY);
    await page.mouse.move(5, 100);
    await page.mouse.wheel(0, -900);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => scrollY)).toBe(lockedScroll);
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => scrollY)).toBe(lockedScroll);
    if (width === 375) {
      await dialog.hover();
      await page.mouse.wheel(0, 500);
      await expect.poll(() => dialog.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      expect(await page.evaluate(() => scrollY)).toBe(lockedScroll);
    }
    const submit = dialog.getByRole("button", { name: "Delete account", exact: true });
    await expect(submit).toBeDisabled();
    await dialog.getByLabel("Confirm your password").fill("TestPassword123");
    await expect(submit).toBeDisabled();
    await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
    await expect(submit).toBeEnabled();
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `/tmp/codeforge-delete-account-${width}.png`, animations: "disabled" });
    await submit.click();
    await expect(dialog.getByRole("alert")).toContainText("Something went wrong on our side");
    expect(accountRequests).toBe(1);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.mouse.move(5, 100);
    await page.mouse.wheel(0, -500);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(lockedScroll);
    await page.getByRole("button", { name: "Delete account", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Delete account", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test(`project deletion preserves confirmation and errors at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 375 ? 480 : 1000 });
    let deletes = 0;
    await page.route("**/api/backend/projects/project-delete", route => {
      if (route.request().method() === "DELETE") { deletes++; return route.fulfill({ status: 500, json: { error: { code: "server_error", message: "Deletion unavailable" } } }); }
      return route.fulfill({ json: { id: "project-delete", name: "Library API", description: "Project preview", created_at: "2026-09-23T00:00:00Z" } });
    });
    await page.route("**/api/backend/projects/project-delete/runs/page*", route => route.fulfill({ json: { items: [], next_cursor: null, stats: { total: 0, succeeded: 0, failed: 0, active: 0, avg_loops: 0, last: null } } }));
    await page.goto("/projects/project-delete");
    await page.getByRole("button", { name: "Delete project", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Delete this project?" });
    await expect(dialog).toBeVisible();
    const lockedScroll = await page.evaluate(() => scrollY);
    await page.mouse.move(5, 100);
    await page.mouse.wheel(0, -900);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => scrollY)).toBe(lockedScroll);
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => scrollY)).toBe(lockedScroll);
    if (width === 375) {
      await dialog.hover();
      await page.mouse.wheel(0, 500);
      await expect.poll(() => dialog.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      expect(await page.evaluate(() => scrollY)).toBe(lockedScroll);
    }
    const submit = dialog.getByRole("button", { name: "Delete project", exact: true });
    await expect(submit).toBeDisabled();
    await dialog.getByLabel("Type Library API to confirm").fill("Wrong project");
    await expect(submit).toBeDisabled();
    await dialog.getByLabel("Type Library API to confirm").fill("Library API");
    await expect(submit).toBeEnabled();
    await page.screenshot({ path: `/tmp/codeforge-delete-project-${width}.png`, animations: "disabled" });
    await submit.click();
    await expect(dialog.getByRole("alert")).toContainText("Something went wrong on our side");
    expect(deletes).toBe(1);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await page.mouse.move(5, 100);
    await page.mouse.wheel(0, -500);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(lockedScroll);
    await page.getByRole("button", { name: "Delete project", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Delete project", exact: true })).toBeDisabled();
  });
}
