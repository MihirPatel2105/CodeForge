import { expect, test } from "@playwright/test";

for (const width of [1440, 390, 320]) {
  test(`product-led hero stays readable and usable at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Great ideas deserve to work.", exact: true })).toBeVisible();
    await expect(page.locator(".ol-announcement, .ol-desktop-nav")).toHaveCount(0);
    await expect(page.locator(".cf-site-header")).toHaveCSS("height", "64px");
    for (const button of await page.locator('.lp-button, .cf-site-header a[href="/signup"]').all()) {
      const shape = await button.evaluate(element => ({ radius: parseFloat(getComputedStyle(element).borderRadius), height: element.getBoundingClientRect().height }));
      expect(shape.radius).toBeGreaterThanOrEqual(shape.height / 2);
    }
    await expect(page.locator(".lp-hero")).toHaveCSS("background-color", "rgb(7, 9, 15)");
    await expect(page.locator(".ol-product-workspace")).toBeVisible();
    await expect(page.locator(".ol-product-outcome [role=status]")).not.toBeEmpty();
    const action = page.locator(".lp-actions").getByRole("link", { name: "Build your first API", exact: true });
    await expect(action).toHaveAttribute("href", "/signup");
    await action.click({ trial: true });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".ol-product-shell")).toHaveCSS("transform", "none");
    await expect(page.locator(".ol-tech-track")).toHaveCSS("animation-name", "none");
    const preview = page.locator(".ol-product-shell");
    await preview.scrollIntoViewIfNeeded();
    const before = await preview.boundingBox();
    await page.mouse.move(20, 250);
    await expect.poll(async () => (await preview.boundingBox())!.width).toBe(before!.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(errors).toEqual([]);
  });
}

test("the product preview and navigation work without WebGL", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type, ...args) {
      if (type === "webgl2") return null;
      return original.call(this, type, ...args);
    } as typeof original;
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Follow the Library build", exact: true }).click();
  await expect(page.locator("#cf-story-title")).toBeInViewport();
  await expect(page.locator(".ol-process-panel")).toHaveCount(4);
});

test("signed-in header keeps CodeForge account actions and capsule Projects button", async ({ page }) => {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "header-user", first_name: "Preview", email: "preview@example.com", is_admin: false } }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
  await page.goto("/");
  const header = page.locator(".cf-site-header");
  const projects = header.getByRole("link", { name: "Projects", exact: true });
  await expect(projects).toBeVisible();
  const shape = await projects.evaluate(element => ({ radius: parseFloat(getComputedStyle(element).borderRadius), height: element.getBoundingClientRect().height }));
  expect(shape.radius).toBeGreaterThanOrEqual(shape.height / 2);
  await expect(header.getByRole("button", { name: "Open command palette" })).toBeVisible();
  await expect(header.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
});

test("hero copy follows smooth scrolling and respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const copy = page.locator(".lp-hero-copy");
  await expect(page.locator("html")).toHaveClass(/lenis/);
  await expect(copy).toHaveCSS("opacity", "1");
  await page.mouse.move(600, 250);
  await page.mouse.wheel(0, 320);
  await expect.poll(() => copy.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)).toBeLessThan(-10);
  await page.mouse.wheel(0, -1000);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2);
  await expect(copy).toHaveCSS("opacity", "1");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.mouse.wheel(0, 320);
  await expect(copy).toHaveCSS("transform", "none");
  await expect(copy).toHaveCSS("opacity", "1");
});

test("live hero rays yield to reduced motion and retain the static fallback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const rays = page.locator(".cf-hero-rays");
  await expect(rays).toHaveAttribute("aria-hidden", "true");
  await expect(rays).toHaveCSS("pointer-events", "none");
  await expect(rays.locator("canvas")).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(rays.locator("canvas")).toHaveCount(0);
  await expect(rays).toHaveCSS("background-image", /radial-gradient/);
  await expect(page.locator(".lp-hero h1")).toHaveCSS("color", "rgb(248, 250, 255)");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(rays.locator("canvas")).toHaveCount(1);
});

for (const width of [1440, 390]) {
  test(`hero header follows the white preview boundary in both directions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const header = page.locator("header.cf-site-header");
    const surface = header.locator(".cf-site-header-bar");
    const opacity = () => surface.evaluate(element => getComputedStyle(element, "::before").opacity);
    await expect(surface).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(surface).toHaveCSS("backdrop-filter", "none");
    await expect.poll(opacity).toBe("0");
    await expect(header).toHaveCSS("height", "64px");
    const previewStart = await page.locator(".ol-product-stage").evaluate(element => element.getBoundingClientRect().top + window.scrollY + parseFloat(getComputedStyle(element).paddingTop));
    await page.evaluate(() => window.scrollTo(0, 350));
    await expect(header).not.toHaveAttribute("data-scrolled");
    await expect.poll(opacity).toBe("0");
    await page.evaluate(end => window.scrollTo(0, end - 32), previewStart);
    await expect.poll(async () => Number(await opacity())).toBeGreaterThan(0.4);
    await expect.poll(async () => Number(await opacity())).toBeLessThan(0.6);
    await page.evaluate(end => window.scrollTo(0, end + 100), previewStart);
    await expect.poll(opacity).toBe("1");
    await expect(header).toHaveAttribute("data-scrolled", "");
    await page.evaluate(() => window.scrollTo(0, 200));
    await expect.poll(opacity).toBe("0");
    await expect(header).not.toHaveAttribute("data-scrolled");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("link", { name: "How CodeForge works", exact: true }).click();
    await expect(page).toHaveURL(/\/how-it-works$/);
    await expect(header).toHaveAttribute("data-hero-overlay", "true");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(opacity).toBe("0");
    const processEnd = await page.locator("#overview").evaluate(element => element.getBoundingClientRect().bottom + scrollY);
    await page.evaluate(end => window.scrollTo(0, end + 100), processEnd);
    await expect.poll(opacity).toBe("1");
    await expect(header).toHaveAttribute("data-scrolled", "");
  });
}

test("header surface eases through intermediate opacity when crossing the preview boundary", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect.poll(() => page.locator("header.cf-site-header").evaluate(element => element.style.getPropertyValue("--hero-header-progress"))).toBe("0");
  const midpoint = await page.locator(".cf-site-header-bar").evaluate(async element => {
    // Capture the real transition when it starts instead of racing page hydration and WebGL startup.
    const started = new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => { element.removeEventListener("transitionrun", onTransition); reject(new Error("Header opacity transition did not start")); }, 5000);
      function onTransition(event: Event) {
        const transition = event as TransitionEvent;
        if (transition.propertyName !== "opacity" || transition.pseudoElement !== "::before") return;
        const animation = element.getAnimations({ subtree: true }).find(item => item instanceof CSSTransition && item.transitionProperty === "opacity");
        if (!animation?.effect) return;
        clearTimeout(timeout);
        element.removeEventListener("transitionrun", onTransition);
        animation.pause();
        animation.currentTime = Number(animation.effect.getTiming().duration) / 2;
        const opacity = Number(getComputedStyle(element, "::before").opacity);
        animation.finish();
        resolve(opacity);
      }
      element.addEventListener("transitionrun", onTransition);
    });
    const preview = document.querySelector(".ol-product-stage")!;
    window.scrollTo({ top: preview.getBoundingClientRect().top + window.scrollY + parseFloat(getComputedStyle(preview).paddingTop) + 100, behavior: "instant" });
    return started;
  });
  expect(midpoint).toBeGreaterThan(0.05);
  expect(midpoint).toBeLessThan(0.95);
  await expect.poll(() => page.locator(".cf-site-header-bar").evaluate(element => Number(getComputedStyle(element, "::before").opacity))).toBe(1);
});
