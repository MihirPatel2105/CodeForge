import { expect, test, type Page } from "@playwright/test";

// Admin tables scroll inside their own panel (components/admin/admin-editorial.css). Reaching a
// panel's end must never move the page, while the page still scrolls normally outside the panels.

const at = "2026-10-26T21:00:00Z";
const user = { id: "admin-user", email: "operator@example.com", first_name: "Operator", last_name: "", created_at: at, is_admin: true, email_verified: true, totp_enabled: true };
const runs = Array.from({ length: 30 }, (_, index) => ({
  id: `run-${index}`, project_id: "project", project_name: "Contact Directory", user_id: "owner", user_email: "owner@example.com",
  prompt: "Build a CRUD API for books with title and author", status: "succeeded", is_live: false, iterations: 1,
  acceptance_level: "L5", test_pass_ratio: 1, provider_fallbacks: 0, end_to_end_ms: 185000, created_at: at, updated_at: at,
}));

async function session(page: Page) {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: { error: { code: "not_found", message: "Unavailable" } } }));
  await page.route("**/api/backend/auth/admin-access", route => route.fulfill({ json: { allowed: true, expires_at: new Date(Date.now() + 3600000).toISOString() } }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: user }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
  await page.route(/\/api\/backend\/admin\/runs(\?.*)?$/, route => route.fulfill({ json: { items: runs, pagination: { page: 1, page_size: 25, total: 30, pages: 2 } } }));
}

const pageScroll = (page: Page) => page.evaluate(() => Math.round(scrollY));

async function wheel(page: Page, deltaY: number, times: number) {
  for (let step = 0; step < times; step += 1) { await page.mouse.wheel(0, deltaY); await page.waitForTimeout(60); }
  await page.waitForTimeout(1000);
}

test("an admin table panel scrolls on its own and never drags the page at its ends", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await session(page);
  await page.goto("/admin/runs");
  const panel = page.locator(".cf-admin-table-scroll:visible").first();
  await expect(panel.locator("tbody tr").first()).toBeVisible();
  // Smooth scrolling (components/layout/app-scroll.tsx) handles the wheel once it has started.
  await expect(page.locator("html")).toHaveClass(/lenis/);
  await page.waitForTimeout(600);

  // Outside the panel (over the side navigation) the page still scrolls.
  await page.mouse.move(150, 700);
  await wheel(page, 120, 2);
  const parked = await pageScroll(page);
  expect(parked).toBeGreaterThan(0);

  // Over the panel: far more wheel than it holds. The panel reaches its end; the page stays put.
  const box = (await panel.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, Math.min(box.y + 160, 860));
  await wheel(page, 400, 20);
  const end = await panel.evaluate(element => ({ top: element.scrollTop, max: element.scrollHeight - element.clientHeight }));
  expect(end.max).toBeGreaterThan(0);
  expect(end.max - end.top).toBeLessThanOrEqual(2);
  expect(Math.abs((await pageScroll(page)) - parked)).toBeLessThanOrEqual(2);

  // And back up past the top: the panel returns to the start; the page still does not move.
  await wheel(page, -400, 20);
  expect(await panel.evaluate(element => element.scrollTop)).toBe(0);
  expect(Math.abs((await pageScroll(page)) - parked)).toBeLessThanOrEqual(2);

  // The header row stays pinned while the rows scroll beneath it.
  await panel.evaluate(element => { element.scrollTop = 400; });
  const headerOffset = await panel.evaluate(element => element.querySelector("thead")!.getBoundingClientRect().top - element.getBoundingClientRect().top);
  expect(Math.abs(headerOffset)).toBeLessThanOrEqual(1);
});
