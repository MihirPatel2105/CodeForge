import { expect, test } from "@playwright/test";

// These tests exercise DOM interactions and Motion transitions without requiring WebGL.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type, ...args) {
      if (type === "webgl2") return null;
      return original.call(this, type, ...args);
    } as typeof original;
  });
});

test("all sections are available before scrolling and reduced motion stays still", async ({ page }) => {
  await page.goto("/");

  const stack = page.locator("#how");
  await expect(stack).toBeAttached();
  await expect(page.locator("html")).toHaveClass(/lenis/);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");

  await stack.scrollIntoViewIfNeeded();
  await expect(stack.getByRole("heading", { name: "Six stages. One clear job each." })).toBeVisible();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(stack.locator(".el-card")).toHaveCount(6);
  // Reduced motion must expose even the repair walkthrough below the viewport.
  await expect(page.locator(".el-loop")).toHaveCSS("opacity", "1");
  await expect(stack.getByRole("heading", { name: "Architect", exact: true })).toBeVisible();
  await expect(stack.getByText("API design", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 720 });
  await expect(stack.getByText("Real results", { exact: true })).toBeVisible();
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
  // The product film (components/marketing/product-film.tsx) took over the preview's scroll growth.
  const preview = page.locator(".el-film-stage");
  await expect(preview).toBeVisible();
  await expect.poll(() => page.locator(".lh-title span").last().evaluate(element => getComputedStyle(element).opacity)).toBe("1");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect.poll(() => preview.evaluate(element => element.getBoundingClientRect().width)).toBeLessThan(1090);
  const before = await page.locator("#how").evaluate(element => (element as HTMLElement).offsetTop);
  // Measure the preview's own scale, not its bounding box: while it is tilted in 3D its near edge
  // looks wider, which cancels the growth out of the box width as it flattens.
  const scale = () => preview.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m11);
  const initialScale = await scale();
  expect(initialScale).toBeLessThan(0.95);
  // Scroll the preview well into view (the full-height hero puts it below the fold).
  await page.evaluate(() => {
    const top = document.querySelector(".el-film-frame")!.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top - window.innerHeight / 2, behavior: "instant" });
  });
  await expect.poll(scale).toBeGreaterThan(initialScale + 0.02);
  const after = await page.locator("#how").evaluate(element => (element as HTMLElement).offsetTop);
  expect(Math.abs(after - before)).toBeLessThan(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(preview).toHaveCSS("transform", "none");
  await expect(page.locator(".lh-title span").last()).toHaveCSS("animation-name", "none");
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(preview).toHaveCSS("transform", "none");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("homepage product preview leads into the stages and the build walkthrough", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const teaser = page.getByRole("link", { name: "Follow the Library build", exact: true });
  await expect(teaser).toHaveAttribute("href", "#build-story");
  await expect(page.locator(".lp-pipeline-content")).toHaveCount(0);
  // Under the hero: the statement, the sample run, the tools line, then the six stages.
  const order = await page.evaluate(() => [...document.querySelector("#overview + .el-body")!.children].slice(0, 4).map(element => element.id || element.classList[0]));
  expect(order).toEqual(["el-statement", "el-product", "el-tools", "how"]);
  await teaser.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#el-steps-title")).toBeInViewport();
  await expect(page.locator("#build-story li")).toHaveCount(4);
  await expect(page.locator("#example-apis").getByRole("link", { name: "Watch the replay" }).first()).toHaveAttribute("href", "/demo/library");
});

test("all agent cards remain readable when motion preference changes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const cards = page.locator("#how .el-card");
  await expect(cards).toHaveCount(6);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const card of await cards.all()) {
    await card.scrollIntoViewIfNeeded();
    await expect(card).toHaveCSS("opacity", "1");
    await expect(card).toHaveCSS("transform", "none");
  }
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
  await expect(answer.getByText(/CRUD REST APIs: applications that create/)).toBeVisible();
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
  await expect(page.getByText("Not using examples")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.keyboard.press("Space");
  await expect(toggle).toBeChecked();
  await expect(page.getByText("Learning from example APIs")).toBeVisible();
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
  await expect(page.getByRole("tab", { name: "Sandbox", exact: true })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Sandbox", exact: true })).toHaveAttribute("aria-selected", "true");
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
