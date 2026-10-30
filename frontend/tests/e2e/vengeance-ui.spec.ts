import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true });

const project = { id: "vui-project", name: "Library API", description: "Manage a book collection", archived: false, created_at: "2026-10-13T10:00:00Z" };
const stats = { total: 12, succeeded: 9, failed: 3, avg_loops: 1.5 };
async function session(page: Page) {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "user-1", first_name: "Alex", email: "user@example.com", is_admin: false } }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
  await page.route("**/api/backend/projects/overview*", route => route.fulfill({ json: {
    items: [{ ...project, stats, recent_runs: [] }], next_cursor: null, total_projects: 1, total_runs: 12, total_succeeded: 9, matching_projects: 1,
  } }));
  await page.route(`**/api/backend/projects/${project.id}`, route => route.fulfill({ json: project }));
  await page.route(`**/api/backend/projects/${project.id}/runs/page*`, route => route.fulfill({ json: { items: [], stats, next_cursor: null } }));
}

for (const width of [1440, 375]) {
  test(`agent cards and FAQ support keyboard and ${width}px layout`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/");
    await expect(page.locator(".vui-agent-card")).toHaveCount(6);
    await expect(page.locator("#control")).toHaveCount(0);
    for (const card of await page.locator(".vui-agent-card").all()) {
      const bounds = await card.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    }
    const faq = page.getByRole("button", { name: "What can I build?", exact: true });
    await faq.focus();
    await page.keyboard.press("Enter");
    await expect(faq).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("button", { name: "Do I get to approve the plan?", exact: true }).click();
    await expect(faq).toHaveAttribute("aria-expanded", "true");
    await faq.click();
    await expect(faq).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
    await expect(page.locator(".vui-footer-word")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `/tmp/codeforge-vengeance-footer-${width}.png` });
    await page.locator(".vui-agent-grid").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/codeforge-vengeance-agents-${width}.png` });
  });
}

test("project cards preserve navigation and show actual accessible totals", async ({ page }) => {
  await session(page);
  await page.goto("/projects");
  await expect(page.locator("dl").first()).toContainText("12");
  await expect(page.locator(".vui-number .sr-only")).toHaveText(["1", "12", "9"]);
  const card = page.getByRole("link", { name: /Library API Manage a book collection/ });
  await expect(card).toContainText("12 runs · code and test results");
  await card.focus();
  await page.screenshot({ path: "/tmp/codeforge-vengeance-projects.png", fullPage: true });
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`/projects/${project.id}`);
});

test("run button follows request state and tooltips work with keyboard and touch", async ({ page }) => {
  await session(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let submissions = 0;
  await page.route("**/api/backend/runs", async route => {
    submissions++;
    await gate;
    await route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Please try again shortly." } } });
  });
  await page.goto(`/projects/${project.id}`);
  const start = page.getByRole("button", { name: "Start run", exact: true });
  await expect(start).toBeDisabled();
  await page.getByLabel("Describe the API").fill("Build a library API");
  await start.focus();
  await expect(start).toHaveAttribute("aria-busy", "false");
  const help = page.getByRole("button", { name: "About average loops" });
  await help.focus();
  await expect(page.getByRole("tooltip")).toContainText("Average repair iterations");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await start.click();
  const pending = page.getByRole("button", { name: "Starting…" });
  await expect(pending).toBeDisabled();
  await expect(pending).toHaveAttribute("aria-busy", "true");
  expect(submissions).toBe(1);
  release();
  await expect(start).toBeEnabled();
  await page.setViewportSize({ width: 375, height: 812 });
  await help.tap();
  await expect(page.getByRole("tooltip")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("reduced motion displays final values and disables decorative movement", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await session(page);
  await page.goto("/projects");
  const strip = page.locator(".vui-digit-strip").first();
  await expect(strip).toBeVisible();
  await expect.poll(() => strip.evaluate(el => el.getAnimations().filter(animation => animation.playState === "running").length)).toBe(0);
  await page.goto(`/projects/${project.id}`);
  const start = page.getByRole("button", { name: "Start run", exact: true });
  await expect(start).toBeVisible();
  await page.getByLabel("Describe the API").fill("Build a books API");
  await expect(start).toBeEnabled();
  await start.hover();
  const highlight = await start.evaluate(el => {
    const style = getComputedStyle(el, "::after");
    return { background: style.backgroundImage, transition: style.transitionDuration, animation: style.animationName };
  });
  expect(highlight).toEqual({ background: "none", transition: "0s", animation: "none" });
  await page.goto("/");
  await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
  await expect(page.locator(".vui-footer-word")).toHaveCount(0);
});

test("FAQ page and dark footer retain readable content and links", async ({ page }) => {
  await page.goto("/faq");
  const question = page.locator(".vui-faq-item button").first();
  await question.click();
  await expect(question).toHaveAttribute("aria-expanded", "true");
  const panelId = await question.getAttribute("aria-controls");
  await expect(page.locator(`[id="${panelId}"]`)).toHaveCSS("opacity", "1");
  await page.setViewportSize({ width: 375, height: 812 });
  await question.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/codeforge-vengeance-faq-dark.png" });
  await page.goto("/");
  await page.locator("#example-apis").scrollIntoViewIfNeeded();
  await expect(page.locator(".cf-demo-slide")).toHaveCount(3);
  await page.screenshot({ path: "/tmp/codeforge-vengeance-examples-dark.png" });
  const footer = page.getByRole("contentinfo");
  await expect(footer).toHaveClass(/cf-invert/);
  await expect(footer.getByRole("link", { name: "FAQ", exact: true })).toHaveAttribute("href", "/faq");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("help tooltip opens on a tap that follows mouse input", async ({ page }) => {
  await session(page);
  await page.goto(`/projects/${project.id}`);
  // A touchscreen laptop: the pointer is used first, then the screen is tapped.
  await page.getByLabel("Describe the API").click();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "About average loops" }).tap();
  await expect(page.getByRole("tooltip")).toContainText("Average repair iterations");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});
