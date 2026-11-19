import { expect, test } from "@playwright/test";

for (const width of [1440, 375]) {
  test(`run history scrolls independently at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => document.cookie = "codeforge_session_present=1; Path=/");
    await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "user-1", email: "user@example.com", first_name: "Regular", last_name: "User", created_at: "2026-09-23T00:00:00Z", is_admin: false, email_verified: true, totp_enabled: false } }));
    await page.route("**/api/backend/projects/history-project", route => route.fulfill({ json: { id: "history-project", name: "Library API", description: "History preview", created_at: "2026-09-23T00:00:00Z" } }));
    const items = Array.from({ length: 20 }, (_, i) => ({ id: `run-${i}`, project_id: "history-project", prompt: `Build library version ${i}`, status: "succeeded", iterations: 1, created_at: "2026-09-23T00:00:00Z", updated_at: "2026-09-23T00:01:00Z" }));
    await page.route("**/api/backend/projects/history-project/runs/page*", route => route.fulfill({ json: { items, next_cursor: null, stats: { total: 20, succeeded: 20, failed: 0, active: 0, avg_loops: 1, last: items[0] } } }));
    await page.goto("/projects/history-project");
    const history = page.getByRole("region", { name: "Run history list" });
    await history.scrollIntoViewIfNeeded();
    await expect(history.getByRole("link", { name: "Open run: Build library version 0", exact: true })).toBeVisible();
    await expect.poll(() => history.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    // Stop the page's preceding scroll before checking wheel containment.
    await page.mouse.move(2, 100);
    await page.waitForTimeout(500);
    const before = await page.evaluate(() => scrollY);
    await history.hover();
    await page.mouse.wheel(0, 700);
    await expect.poll(() => history.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => scrollY)).toBe(before);
    if (width === 1440) await expect(history.getByRole("heading", { level: 3 }).first()).toHaveCSS("position", "sticky");
    await history.evaluate(element => element.scrollTop = element.scrollHeight);
    await history.hover();
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => scrollY)).toBe(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
