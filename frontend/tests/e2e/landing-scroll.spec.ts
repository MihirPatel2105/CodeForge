import { expect, test } from "@playwright/test";

test("desktop scroll advances the pipeline and section navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  const track = page.locator(".lp-agent-track");
  await expect(track).toHaveAttribute("data-scroll-enabled", "true");
  for (const [index, name] of ["PM", "Architect", "Coder", "Reviewer", "Tester", "Sandbox"].entries()) {
    await track.evaluate((el, index) => {
      const start = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.18;
      window.scrollTo({ top: start + (el.clientHeight - window.innerHeight * 0.64) * ((index + 0.5) / 6), behavior: "instant" });
    }, index);
    await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".lp-agent-output li").first()).toHaveCSS("opacity", "1");
  }
  await page.getByRole("navigation", { name: "Landing page sections" }).getByRole("link", { name: "FAQ", exact: true }).click();
  await expect(page.locator("#faq-title")).toBeInViewport();
  await expect(page.locator('.lp-scroll-nav a[href="#questions"]')).toHaveAttribute("aria-current", "location");
  await page.screenshot({ path: "/tmp/codeforge-landing-desktop.png" });
  expect(errors).toEqual([]);
});

for (const mode of ["mobile", "reduced"] as const) {
  test(`${mode} keeps every stage accessible without sticky scrolling`, async ({ page }) => {
    await page.setViewportSize(mode === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    if (mode === "reduced") await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator(".lp-agent-track")).toHaveAttribute("data-scroll-enabled", "false");
    await expect(page.getByRole("button", { name: "Sandbox", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Sandbox", exact: true }).click();
    await expect(page.locator(".lp-agent-phase")).toContainText("Sandbox");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/codeforge-landing-${mode}.png` });
  });
}
