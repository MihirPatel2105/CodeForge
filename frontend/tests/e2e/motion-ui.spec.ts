import { expect, test } from "@playwright/test";

test("all sections are available before scrolling and reduced motion stays still", async ({ page }) => {
  await page.goto("/");

  const stack = page.locator("#how");
  await expect(stack).toBeAttached();
  await expect(stack).toHaveCSS("opacity", "1");
  await expect(page.locator("html")).toHaveClass(/lenis/);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");

  await stack.scrollIntoViewIfNeeded();
  await expect(stack.getByRole("heading", { name: "Five specialists. One continuous workflow." })).toBeVisible();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Explore the five agents" }).getByRole("button")).toHaveCount(5);
  const agents = page.getByRole("navigation", { name: "Explore the five agents" });
  const architect = agents.getByRole("button", { name: "Architect", exact: true });
  await architect.focus();
  await page.keyboard.press("Enter");
  await expect(architect).toHaveAttribute("aria-pressed", "true");
  await expect(stack.getByRole("heading", { name: "A clear plan. Before the code." })).toBeVisible();
  await expect(stack.getByText("/books/{id}", { exact: true })).toHaveCount(3);
  await expect(stack.getByText("Example output", { exact: true })).toBeVisible();
  await expect(stack.locator(".lp-agent-content")).toHaveCSS("animation-name", "none");
  await agents.getByRole("button", { name: "Reviewer", exact: true }).click();
  await expect(stack.getByText("Requested change → Coder", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 720 });
  await agents.getByRole("button", { name: "Tester", exact: true }).click();
  await expect(stack.getByText("Failures can trigger another repair", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
});

test("changing motion preference cancels scrolling reveals on the current page", async ({ page }) => {
  await page.goto("/about");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const sections = page.locator("main > section");
  for (const section of await sections.all()) {
    await section.scrollIntoViewIfNeeded();
    await expect(section).toHaveCSS("opacity", "1");
    await expect(section).toHaveCSS("transform", "none");
  }
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
});

test("homepage preview grows without moving subsequent sections and resets for reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const preview = page.locator(".lp-product-scale");
  const pause = page.getByRole("button", { name: "Pause walkthrough" });
  await expect(preview).toBeVisible();
  await expect.poll(() => page.locator(".lp-hero > .lp-actions").evaluate(element => getComputedStyle(element).opacity)).toBe("1");
  if (await pause.isVisible()) await pause.click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect.poll(() => preview.evaluate(element => element.getBoundingClientRect().width)).toBeLessThan(1090);
  const before = await page.locator("#how").evaluate(element => (element as HTMLElement).offsetTop);
  const initialWidth = await preview.evaluate(element => element.getBoundingClientRect().width);
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: "instant" }));
  await expect.poll(() => preview.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(initialWidth);
  const after = await page.locator("#how").evaluate(element => (element as HTMLElement).offsetTop);
  expect(Math.abs(after - before)).toBeLessThan(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(preview).toHaveCSS("transform", "none");
  await expect(page.locator(".lp-product-scroll")).toHaveCSS("transform", "none");
  await expect(page.locator(".lp-product-scroll")).toHaveCSS("opacity", "1");
  await expect(page.locator(".lp-hero > .lp-actions")).toHaveCSS("transform", "none");
  await expect(page.getByRole("button", { name: "Replay walkthrough" })).toBeDisabled();
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(preview).toHaveCSS("transform", "none");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("homepage repair sequence plays once and supports pause, replay, and reduced motion", async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const pipeline = page.locator(".lp-pipeline-content");
  await pipeline.scrollIntoViewIfNeeded();
  const active = pipeline.locator(".lp-pipeline-stages > li[aria-current=step]");
  await expect.poll(async () => {
    await page.clock.runFor(1200);
    return pipeline.locator(".lp-feedback-route > span[data-current=true]").first().textContent().catch(() => "");
  }, { intervals: [50], timeout: 15000 }).toBe("Reviewer");
  await page.clock.runFor(2200);
  await expect(active.getByRole("heading", { name: "Coder", exact: true })).toBeVisible();
  await expect(pipeline.locator(".lp-feedback-route > span[data-current=true]")).toHaveText("Coder");
  await pipeline.getByRole("button", { name: "Pause walkthrough" }).click();
  await page.clock.runFor(5000);
  await expect(active.getByRole("heading", { name: "Coder", exact: true })).toBeVisible();
  await pipeline.getByRole("button", { name: "Play walkthrough" }).click();
  await expect.poll(async () => {
    await page.clock.runFor(2200);
    return pipeline.getByRole("button", { name: "Replay walkthrough" }).isVisible();
  }, { intervals: [50], timeout: 15000 }).toBe(true);
  await page.clock.runFor(5000);
  await expect(pipeline.getByRole("button", { name: "Replay walkthrough" })).toBeVisible();
  await pipeline.getByRole("button", { name: "Replay walkthrough" }).click();
  await expect(active.getByRole("heading", { name: "PM", exact: true })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(pipeline.getByText(/Tests passed/)).toBeVisible();
});

test("rapid agent selection settles on the latest choice and stays still with reduced motion", async ({ page }) => {
  await page.goto("/");
  const agents = page.getByRole("navigation", { name: "Explore the five agents" });
  await agents.scrollIntoViewIfNeeded();
  for (const name of ["Architect", "Reviewer", "Coder", "Tester"]) {
    await agents.getByRole("button", { name, exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "Run it. See what holds up." })).toBeVisible();
  await expect(page.locator(".lp-agent-content")).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".lp-agent-content")).toHaveCSS("transform", "none");
});

test("API cards animate, respect preference changes, and preserve keyboard navigation", async ({ page }) => {
  await page.addInitScript(() => document.cookie = "codeforge_session_present=1; Path=/");
  await page.route("**/api/backend/auth/me", (route) => route.fulfill({
    json: { id: "user-1", email: "user@example.com", first_name: "Regular", last_name: "User", created_at: "2026-09-23T00:00:00Z", is_admin: false, email_verified: true, totp_enabled: false },
  }));
  await page.route("**/api/backend/runs/*/deployment", (route) => route.fulfill({ json: {
    id: "deployment-1", run_id: "507f1f77bcf86cd799439012", url: "http://localhost:8000/api/v1/deployments/deployment-1", key_prefix: "cf_live_abc", status: "active", created_at: "2026-09-24T00:00:00Z",
  } }));
  await page.route("**/api/backend/runs/*/preview", (route) => route.fulfill({ json: { expires_after_seconds: 900, session_started: false, operations: [] } }));
  await page.goto("/runs/507f1f77bcf86cd799439012/use");
  const card = page.getByRole("link", { name: /Open publish guide/ });
  await card.hover();
  await expect(card).not.toHaveCSS("transform", "none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await card.focus();
  await expect(card).toHaveCSS("transform", "none");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Publish your API" })).toBeVisible();
  const disclosure = page.getByRole("button", { name: "Setup instructions" });
  await disclosure.click();
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  await disclosure.click();
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
});

test("mobile FAQ stays readable during rapid toggles and reduced-motion changes", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const question = page.getByRole("button", { name: "What can I build?" });
  await question.click();
  const answer = page.locator(`[id="${await question.getAttribute("aria-controls")}"]`);
  await expect(answer.getByText(/CodeForge focuses on CRUD REST APIs/)).toBeVisible();
  await question.click();
  await question.click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(answer).toHaveCSS("opacity", "1");
  await question.click();
  await expect(answer).toHaveAttribute("inert", "");
  await expect(answer).toHaveCSS("height", "0px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("switch and disabled buttons preserve keyboard behavior on the project composer", async ({ page }) => {
  await page.addInitScript(() => document.cookie = "codeforge_session_present=1; Path=/");
  await page.route("**/api/backend/auth/me", (route) => route.fulfill({ json: { id: "user-1", email: "user@example.com", first_name: "Regular", last_name: "User", created_at: "2026-09-23T00:00:00Z", is_admin: false, email_verified: true, totp_enabled: false } }));
  await page.route("**/api/backend/projects/motion-project", (route) => route.fulfill({ json: { id: "motion-project", name: "Motion project", description: "", created_at: "2026-09-24T00:00:00Z" } }));
  await page.route("**/api/backend/projects/motion-project/runs/page*", (route) => route.fulfill({ json: { items: [], next_cursor: null, stats: { total: 0, succeeded: 0, failed: 0, active: 0, avg_loops: null, last: null } } }));
  await page.goto("/projects/motion-project");
  const toggle = page.getByRole("switch", { name: "Use example library" });
  await expect(toggle).toBeChecked();
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).not.toBeChecked();
  await expect(page.getByText("Agents use this prompt alone")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.keyboard.press("Space");
  await expect(toggle).toBeChecked();
  await expect(page.getByText("Agents see 6 similar APIs")).toBeVisible();
  const start = page.getByRole("button", { name: /Start run/ });
  await expect(start).toBeDisabled();
  await page.getByLabel("Describe the API").fill("Build a library API");
  await expect(start).toBeEnabled();
});

test("mobile evidence tabs retain arrow-key navigation and active panel semantics", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/library");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const timeline = page.getByRole("tab", { name: "Timeline", exact: true });
  await timeline.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Code", exact: true })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Code", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Tests", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});


test("process example plays once, supports replay, and About shows its output", async ({ page }) => {
  await page.clock.install();
  await page.goto("/how-it-works");
  const process = page.locator(".cf-frame");
  await expect(process.getByText("Five agents + a sandbox", { exact: true })).toBeVisible();
  await expect(process.getByText("Findings or failed tests → Coder", { exact: true })).toBeVisible();
  const replay = process.getByRole("button", { name: "Replay example pipeline" });
  // Let React commit each timed stage before advancing the next timer.
  await expect.poll(async () => {
    await page.clock.runFor(2_000);
    return replay.isVisible();
  }, { intervals: [50], timeout: 15_000 }).toBe(true);
  await page.clock.runFor(5_000);
  await expect(replay).toBeVisible();
  await replay.click();
  const pause = process.getByRole("button", { name: "Pause example pipeline" });
  await expect(pause).toBeVisible();
  await pause.click();
  await page.clock.runFor(5_000);
  await expect(process.getByRole("button", { name: "Resume example pipeline" })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(process.getByText("Example complete", { exact: true })).toBeVisible();
  await expect(process.getByRole("button")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.goto("/about");
  const output = page.getByRole("region", { name: "Library demo source and test result" });
  await expect(output.getByText("main.py", { exact: true })).toBeVisible();
  await expect(output.getByText("8 passed in 1.42s", { exact: true })).toBeVisible();
  await expect(output.getByRole("link", { name: "Inspect the library demo" })).toHaveAttribute("href", "/demo/library");
  await expect(output.getByRole("button")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
