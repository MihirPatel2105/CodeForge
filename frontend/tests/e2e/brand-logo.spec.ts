import { expect, test, type Page } from "@playwright/test";

// The CodeForge lockup: the supplied slab icon beside the Roundex CODEFORGE wordmark, drawn
// from public/brand/codeforge-lockup-{light,dark}-v6.svg (built by scripts/brand/), the icon redrawn
// as vector geometry (Roundex-matched corners) with its slabs optically weighted.
const LOCKUP_RATIO = 2285 / 447;
// The navbar icon keeps the height it had before the wider wordmark (150px-wide v3 lockup).
const NAVBAR_ICON_HEIGHT = 150 / (1880 / 447);

async function scrollTo(page: Page, y: number) {
  await page.evaluate(async (top) => {
    window.scrollTo({ top, behavior: "instant" });
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, y);
}

const lockupSource = (page: Page, scope: string) =>
  page.locator(`${scope} .cf-logo-lockup img`).first().getAttribute("src");

test("the navbar and footer use the Roundex lockup in the right ink", async ({ page }) => {
  await page.goto("/about");
  expect(await lockupSource(page, "[data-launch-header]")).toContain("codeforge-lockup-light-v6.svg");
  expect(await lockupSource(page, "footer")).toContain("codeforge-lockup-dark-v6.svg");
});

test("the sign-in panel uses the white lockup", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto("/login");
  expect(await page.locator('.cf-logo-lockup[data-logo-variant="dark"] img').first().getAttribute("src"))
    .toContain("codeforge-lockup-dark-v6.svg");
});

test("the lockup keeps the new artwork's proportions", async ({ page }) => {
  await page.goto("/about");
  const box = await page.locator("[data-launch-header] .cf-logo-lockup").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width / box!.height).toBeCloseTo(LOCKUP_RATIO, 1);
});

test("folding the wordmark on scroll lands the icon on the bar's centre line", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/about");
  const logo = page.getByRole("banner").getByRole("link", { name: "CodeForge home" });
  await scrollTo(page, 400);
  await expect(logo).toHaveAttribute("data-collapsed", "");
  const [icon, bar] = await Promise.all([
    page.locator("[data-launch-header] .cf-logo-symbol").boundingBox(),
    page.locator("[data-launch-header] .lh-bar").boundingBox(),
  ]);
  expect(Math.abs(icon!.x + icon!.width / 2 - (bar!.x + bar!.width / 2))).toBeLessThan(2);
});

test("a wider wordmark extends the logo instead of shrinking the navbar icon", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/about");
  const lockup = await page.locator("[data-launch-header] .cf-logo-lockup").boundingBox();
  expect(Math.abs(lockup!.height - NAVBAR_ICON_HEIGHT)).toBeLessThan(1.5);
});

test("the lockup artwork is pure vector, with no embedded image", async ({ request }) => {
  for (const ink of ["light", "dark"]) {
    const svg = await (await request.get(`/brand/codeforge-lockup-${ink}-v6.svg`)).text();
    expect(svg).not.toContain("<image");
    expect(svg).toContain("<path");
  }
});

test("the favicon and app icons are the slab mark on its dark tile", async ({ page, request }) => {
  await page.goto("/about");
  const svgIcon = await page.locator('link[rel="icon"][type="image/svg+xml"]').getAttribute("href");
  const svg = await (await request.get(svgIcon!)).text();
  expect(svg).toContain('fill="#141413"');
  expect(svg).toContain("<rect");
  expect(svg).toContain("#f5f3ee");
  for (const path of ["/icon.png", "/apple-icon.png", "/favicon.ico"]) {
    expect((await request.get(path)).ok()).toBe(true);
  }
});

test("the loading screen assembles the mark, and holds it still with reduced motion", async ({ page }) => {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", () => new Promise(() => {})); // never resolve: stay loading
  for (const motion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion: motion });
    await page.goto("/runs/loading-run");
    const mark = page.getByRole("status", { name: "Loading run", exact: true }).locator("svg.cf-assemble[data-looping]");
    await expect(mark).toBeVisible();
    await expect(mark.locator("path")).toHaveCount(4);
    const animation = await mark.locator("path").first().evaluate((node) => getComputedStyle(node).animationName);
    expect(animation).toBe(motion === "reduce" ? "none" : "cf-assemble-loop");
  }
});
