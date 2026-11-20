import { expect, test, type Page } from "@playwright/test";

const HEADLINE = { level: 1, name: "From an idea to a tested API" } as const;

for (const width of [1440, 390, 320]) {
  test(`landing hero stays readable and usable at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.getByRole("heading", HEADLINE)).toBeVisible();
    await expect(page.locator(".ol-announcement, .ol-desktop-nav")).toHaveCount(0);
    await expect(page.locator("[data-launch-header]")).toHaveCSS("height", width < 640 ? "64px" : "76px");
    // The top bar keeps capsule pills; page buttons take the 12px primary-action corner.
    const pill = page.locator('[data-launch-header] a[href="/signup"]');
    const pillShape = await pill.evaluate(element => ({ radius: parseFloat(getComputedStyle(element).borderRadius), height: element.getBoundingClientRect().height }));
    expect(pillShape.radius).toBeGreaterThanOrEqual(pillShape.height / 2);
    await expect(page.locator("#start-building .el-primary")).toHaveCSS("border-radius", "12px");
    const start = page.locator("[data-launch-header]").getByRole("link", { name: "Get started", exact: true });
    await expect(start).toHaveAttribute("href", "/signup");
    // Under the hero: the product film, waiting behind its play button.
    await page.locator(".el-product").scrollIntoViewIfNeeded();
    await expect(page.locator(".el-film-video")).toBeVisible();
    await expect(page.getByRole("button", { name: /Play the film/ })).toBeVisible();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".el-film-stage")).toHaveCSS("transform", "none");
    const preview = page.locator(".el-film-stage");
    await preview.scrollIntoViewIfNeeded();
    const before = await preview.boundingBox();
    await page.mouse.move(20, 250);
    await expect.poll(async () => (await preview.boundingBox())!.width).toBe(before!.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(errors).toEqual([]);
  });
}

test("without WebGL the hero keeps a lit horizon and the page still navigates", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type, ...args) {
      if (type === "webgl" || type === "webgl2") return null;
      return original.call(this, type, ...args);
    } as typeof original;
  });
  await page.goto("/");
  const hero = page.locator("#overview");
  await expect(hero).toHaveAttribute("data-webgl", "off");
  await expect(hero.locator(".lh-world")).toBeHidden();
  await expect(hero.locator(".lh-orbit")).toHaveCount(1);
  await expect(hero.locator(".lh-node-label")).toHaveCount(0);
  await page.getByRole("link", { name: "Follow the Library build", exact: true }).click();
  // "Follow the build" lands on the step-by-step walkthrough.
  await expect(page.locator("#el-steps-title")).toBeInViewport();
  await expect(page.locator("#build-story li")).toHaveCount(4);
});

test("signed-in header keeps CodeForge account actions and capsule Projects button", async ({ page }) => {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "header-user", first_name: "Preview", email: "preview@example.com", is_admin: false } }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
  await page.goto("/");
  const header = page.locator("[data-launch-header]");
  const projects = header.getByRole("link", { name: "Projects", exact: true });
  await expect(projects).toBeVisible();
  const shape = await projects.evaluate(element => ({ radius: parseFloat(getComputedStyle(element).borderRadius), height: element.getBoundingClientRect().height }));
  expect(shape.radius).toBeGreaterThanOrEqual(shape.height / 2);
  await expect(header.getByRole("button", { name: "Open command palette" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Get started", exact: true })).toHaveCount(0);
});

test("a failed account check can be retried from the bar", async ({ page }) => {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
  let healthy = false;
  await page.route("**/api/backend/auth/me", route => healthy
    ? route.fulfill({ json: { id: "retry-user", first_name: "Retry", email: "retry@example.com", is_admin: false } })
    : route.fulfill({ status: 503, json: { detail: "unavailable" } }));
  await page.goto("/");
  const header = page.locator("[data-launch-header]");
  const retry = header.getByRole("button", { name: "Retry account" });
  await expect(retry).toBeVisible();
  healthy = true;
  await retry.click();
  await expect(header.getByRole("link", { name: "Projects", exact: true })).toBeVisible();
  await expect(retry).toHaveCount(0);
});

test("the hero sits inside main, so skip to content covers it", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main#landing-content > #overview")).toHaveCount(1);
  await expect(page.locator(".cf-site-header")).toHaveCount(0);
});

// Every public page uses the same top bar; only the app's workspace keeps its own header.
for (const width of [1440, 390]) {
  test(`editorial pages use the new bar, solid in page tone above their cream hero, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const route of ["/how-it-works", "/about", "/faq", "/contact"]) {
      await page.goto(route);
      const header = page.locator("[data-launch-header]");
      await expect(page.locator(".cf-site-header")).toHaveCount(0);
      await expect(header).toHaveAttribute("data-tone", "page");
      await expect(header).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      // These pages give any top-level header a frosted blur; the bar must not pick it up.
      await expect(header).toHaveCSS("backdrop-filter", "none");
      const [barBottom, contentTop] = await Promise.all([
        header.evaluate(bar => bar.getBoundingClientRect().bottom),
        page.locator("#overview > *").first().evaluate(el => el.getBoundingClientRect().top),
      ]);
      expect(contentTop).toBeGreaterThanOrEqual(barBottom - 1);
    }
  });
}

test("pages without a dark hero start in page tone and never sit on top of content", async ({ page }) => {
  for (const route of ["/privacy", "/terms", "/this-page-does-not-exist"]) {
    await page.goto(route);
    const header = page.locator("[data-launch-header]");
    await expect(header).toHaveAttribute("data-tone", "page");
    // Only the landing waits for its hero; everywhere else the bar is there at once.
    await expect.poll(() => header.evaluate(bar => Math.round(bar.getBoundingClientRect().top))).toBe(0);
    const heading = page.getByRole("heading", { level: 1 }).first();
    const [barBottom, headingTop] = await Promise.all([
      header.evaluate(bar => bar.getBoundingClientRect().bottom),
      heading.evaluate(h => h.getBoundingClientRect().top),
    ]);
    expect(headingTop).toBeGreaterThanOrEqual(barBottom);
  }
});

test("the not-found page fits the screen under the bar", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/this-page-does-not-exist");
  await expect(page.locator("[data-launch-header]")).toBeVisible();
  // The main area fills exactly the screen under the 76px bar; the footer follows below it.
  const main = await page.locator("main").first().evaluate(el => el.getBoundingClientRect().height);
  expect(Math.round(main)).toBe(900 - 76);
});

async function signedIn(page: Page, isAdmin = false) {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "ws-user", first_name: "Work", email: "work@example.com", is_admin: isAdmin, created_at: "2026-10-01T09:00:00Z" } }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
  await page.route("**/api/backend/projects**", route => route.fulfill({ json: [] }));
}

// Signed-in pages (projects, runs, profile, settings, admin) share the public site's bar,
// minus the marketing dropdowns: in the workspace those links are noise.
for (const route of ["/projects", "/profile", "/profile/settings"]) {
  test(`${route} uses the shared navbar without the site dropdowns`, async ({ page }) => {
    await signedIn(page);
    await page.goto(route);
    const header = page.locator("[data-launch-header]");
    await expect(header).toHaveCount(1);
    await expect(page.locator(".cf-site-header")).toHaveCount(0);
    await expect(header).toHaveAttribute("data-tone", "page");
    await expect(header.getByRole("button", { name: "Open command palette" })).toBeVisible();
    await expect(header.getByRole("button", { name: "Product", exact: true })).toHaveCount(0);
    await expect(header.getByRole("navigation", { name: "Site" })).toHaveCount(0);
  });
}

test("on a phone the workspace bar keeps the logo clear of the account group", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signedIn(page);
  await page.goto("/projects");
  const header = page.locator("[data-launch-header]");
  await expect(header.getByRole("button", { name: "Open command palette" })).toBeVisible();
  const logo = await header.getByRole("link", { name: "CodeForge home" }).boundingBox();
  const search = await header.getByRole("button", { name: "Open command palette" }).boundingBox();
  expect(logo && search).toBeTruthy();
  expect(logo!.x + logo!.width).toBeLessThanOrEqual(search!.x);
});

test("the Projects button is hidden on the projects list, shown elsewhere", async ({ page }) => {
  await signedIn(page);
  await page.goto("/projects");
  const header = page.locator("[data-launch-header]");
  await expect(header.getByRole("button", { name: "Open command palette" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Projects", exact: true })).toHaveCount(0);
  await page.goto("/profile");
  await expect(header.getByRole("link", { name: "Projects", exact: true })).toBeVisible();
});

const logoBox = (page: Page) => page.locator("[data-launch-header] .lh-logo").boundingBox();

test("the logo sits on the left in the workspace and in the centre on the public site", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signedIn(page);
  await page.goto("/profile");
  await expect.poll(async () => (await logoBox(page))?.x ?? 999).toBeLessThan(100);
  await page.goto("/about");
  await expect.poll(async () => {
    const box = await logoBox(page);
    return box ? Math.abs(box.x + box.width / 2 - 640) : 999;
  }).toBeLessThan(4);
});

test("entering the workspace slides the logo across instead of jumping", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signedIn(page);
  await page.goto("/about");
  await expect.poll(async () => (await logoBox(page))?.x ?? 0).toBeGreaterThan(500);
  await page.locator("[data-launch-header]").getByRole("link", { name: "Projects", exact: true }).click();
  const xs: number[] = [];
  for (let i = 0; i < 26; i++) {
    xs.push(Math.round((await logoBox(page))?.x ?? -1));
    await page.waitForTimeout(40);
  }
  const final = xs.at(-1)!;
  expect(final).toBeLessThan(100);
  // At least one frame mid-way: the logo travelled rather than teleporting.
  expect(xs.some((x) => x > final + 40 && x < 500)).toBe(true);
});

test("moving between workspace pages leaves the logo still", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signedIn(page);
  await page.goto("/profile");
  await expect.poll(async () => (await logoBox(page))?.x ?? 999).toBeLessThan(100);
  await page.locator("[data-launch-header]").getByRole("link", { name: "Projects", exact: true }).click();
  await page.waitForURL("**/projects");
  for (let i = 0; i < 6; i++) {
    expect((await logoBox(page))?.x ?? 999).toBeLessThan(100);
    await page.waitForTimeout(40);
  }
});

test("on a phone, a signed-in visitor's public bar fits without overlap", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signedIn(page);
  await page.goto("/about");
  const header = page.locator("[data-launch-header]");
  const search = header.getByRole("button", { name: "Open command palette" });
  await expect(search).toBeVisible();
  const [logo, searchBox, end] = await Promise.all([
    header.getByRole("link", { name: "CodeForge home" }).boundingBox(),
    search.boundingBox(),
    header.locator(".lh-end").boundingBox(),
  ]);
  expect(logo!.x + logo!.width).toBeLessThanOrEqual(searchBox!.x);
  expect(end!.x + end!.width).toBeLessThanOrEqual(375);
  // Projects moves into the menu on phones; the bar keeps search, inbox and avatar.
  await expect(header.getByRole("link", { name: "Projects", exact: true })).toBeHidden();
});

test("on a phone, the menu offers Projects instead of Sign in to a signed-in visitor", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signedIn(page);
  await page.goto("/about");
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const nav = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(nav.getByRole("link", { name: "Projects", exact: true })).toBeInViewport();
  // It leads the menu, so it is reachable without scrolling the list.
  await expect(nav.getByRole("link").first()).toHaveText(/Projects/);
  await expect(nav.getByRole("link", { name: "Sign in" })).toHaveCount(0);
});

test("on a phone, a signed-out visitor's bar fits: logo by the menu, clear of Get started", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/about");
  const header = page.locator("[data-launch-header]");
  const [logo, menu, start] = await Promise.all([
    header.getByRole("link", { name: "CodeForge home" }).boundingBox(),
    header.getByRole("button", { name: "Open navigation menu" }).boundingBox(),
    header.getByRole("link", { name: "Get started", exact: true }).boundingBox(),
  ]);
  expect(logo!.x).toBeGreaterThanOrEqual(menu!.x + menu!.width);
  // At least the bar's own 8px gap between logo and button, not merely no overlap.
  expect(logo!.x + logo!.width).toBeLessThanOrEqual(start!.x - 8);
  expect(start!.x + start!.width).toBeLessThanOrEqual(375);
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("public pages keep the site dropdowns for a signed-in visitor", async ({ page }) => {
  await signedIn(page);
  await page.goto("/about");
  await expect(page.locator("[data-launch-header]").getByRole("button", { name: "Product", exact: true })).toBeVisible();
});

test("the shared navbar marks where a signed-in user is and offers Admin to admins", async ({ page }) => {
  await signedIn(page, true);
  await page.route("**/api/backend/projects/some-project", route => route.fulfill({ json: { id: "some-project", name: "Library API", description: "", created_at: "2026-10-01T09:00:00Z" } }));
  await page.route("**/api/backend/projects/some-project/runs/page*", route => route.fulfill({ json: { items: [], next_cursor: null, stats: { total: 0, succeeded: 0, failed: 0, active: 0, avg_loops: 0, last: null } } }));
  await page.goto("/projects/some-project");
  const header = page.locator("[data-launch-header]");
  await expect(header.getByRole("link", { name: "Projects", exact: true })).toHaveAttribute("aria-current", "page");
  const admin = header.getByRole("link", { name: "Admin", exact: true });
  await expect(admin).toHaveAttribute("href", "/admin");
  await expect(admin).not.toHaveAttribute("aria-current", "page");
});

test("non-admins see no Admin link in the navbar", async ({ page }) => {
  await signedIn(page);
  await page.goto("/profile");
  await expect(page.locator("[data-launch-header]").getByRole("link", { name: "Projects", exact: true })).toBeVisible();
  await expect(page.locator("[data-launch-header]").getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);
});
