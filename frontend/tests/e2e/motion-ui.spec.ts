import { expect, test } from "@playwright/test";

test("all sections are available before scrolling and reduced motion stays still", async ({ page }) => {
  await page.goto("/");

  const stack = page.locator("#how");
  await expect(stack).toBeAttached();
  await expect(stack).toHaveCSS("opacity", "1");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("smooth");

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
