import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "effects-user", first_name: "Preview", is_admin: false } }));
  await page.route("**/api/backend/projects", route => route.fulfill({ json: Array.from({ length: 18 }, (_, i) => ({ id: `project-${i}`, name: `Project ${i}`, created_at: "2026-10-22" })) }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: Array.from({ length: 12 }, (_, i) => ({ id: `run-${i}`, project_id: "project-0", prompt: `Build service ${i}`, status: "succeeded", iterations: 0, created_at: "2026-10-22T08:00:00Z", updated_at: "2026-10-22T08:01:00Z" })) }));
});

test("headline remains accessible and resolves immediately when motion is reduced", async ({ page }) => {
  await page.goto("/");
  const headline = page.getByRole("heading", { level: 1, name: "From an idea to a tested API" });
  await expect(headline).toBeVisible();
  const line = headline.locator("span").last();
  await expect(line).toHaveCSS("opacity", "1");
  const cta = page.locator("#start-building .cf-specular");
  await cta.scrollIntoViewIfNeeded();
  await cta.hover();
  await expect.poll(() => cta.evaluate(node => node.style.getPropertyValue("--light-x"))).not.toBe("");
  await page.screenshot({ path: "/tmp/codeforge-premium-effects-desktop.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(line).toHaveCSS("animation-name", "none");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await expect(headline.locator("span").first()).toHaveCSS("opacity", "1");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("command selection follows keyboard navigation and blur tracks scrollable edges", async ({ page }) => {
  await page.goto("/faq");
  await page.getByRole("button", { name: "Open command palette" }).click();
  const search = page.getByRole("combobox", { name: "Search commands and projects" });
  const selected = page.getByRole("option", { selected: true });
  const frame = page.locator(".cf-command-dialog .cf-gradual-frame");
  await expect(page.getByRole("option", { name: /Project 17/ })).toHaveCount(1);
  await expect(frame).toHaveAttribute("data-top", "false");
  await expect(frame).toHaveAttribute("data-bottom", "true");
  const previous = await selected.getAttribute("id");
  await search.press("ArrowDown");
  await expect(selected).not.toHaveAttribute("id", previous!);
  await expect(selected.locator(".cf-command-selection")).toHaveCount(1);
  await expect(search).toBeFocused();
  for (let i = 0; i < 18; i++) await search.press("ArrowDown");
  await expect(selected).toBeInViewport();
  await expect.poll(async () => {
    const row = await selected.boundingBox();
    const highlight = await selected.locator(".cf-command-selection").boundingBox();
    return Math.abs(row!.y - highlight!.y);
  }).toBeLessThan(2);
  await page.locator(".cf-command-results").evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(frame).toHaveAttribute("data-top", "true");
  await expect(frame).toHaveAttribute("data-bottom", "false");
  await page.screenshot({ path: "/tmp/codeforge-premium-effects-palette.png" });
  await search.fill("Project 17");
  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(frame).toHaveAttribute("data-bottom", "false");
});

test("notification edge treatments preserve narrow-screen scrolling and actions", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 640 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /Run updates/ }).click();
  const panel = page.getByRole("dialog", { name: "Run updates" });
  const frame = panel.locator(".cf-gradual-frame");
  await expect(frame).toHaveAttribute("data-bottom", "true");
  await panel.locator(".cf-gradual-viewport").evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(frame).toHaveAttribute("data-top", "true");
  await expect(frame).toHaveAttribute("data-bottom", "false");
  const bounds = await panel.boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(640);
  await page.screenshot({ path: "/tmp/codeforge-premium-effects-inbox-mobile.png" });
});
