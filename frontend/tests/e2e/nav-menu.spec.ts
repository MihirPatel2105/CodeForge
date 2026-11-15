import { expect, test } from "@playwright/test";

// The top bar groups pages into Product / Demos / Company dropdowns, like Fable's Research / Policy.
const GROUPS = {
  Product: ["How it works", "The five agents", "The build, step by step", "The repair loop", "Questions"],
  Demos: ["Personal Library", "Inventory Control", "Support Desk"],
  Company: ["About", "Contact", "Privacy", "Terms"],
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/backend/auth/me", (route) => route.fulfill({ status: 401, json: {} }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("each pill opens its own panel of links, one at a time", async ({ page }) => {
  await page.goto("/about");
  const bar = page.locator("[data-launch-header]");
  for (const [label, links] of Object.entries(GROUPS)) {
    const pill = bar.getByRole("button", { name: label, exact: true });
    await pill.click();
    await expect(pill).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator(`#${await pill.getAttribute("aria-controls")}`);
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("link")).toHaveText(links);
    await expect(bar.locator(".lh-menu-panel:visible")).toHaveCount(1);
  }
  await expect(bar.locator(".lh-menu-panel[data-columns='2'] ul")).toHaveCSS("grid-template-columns", /^(1fr 1fr|[\d.]+px [\d.]+px)$/);
});

test("keyboard: Enter opens, arrows move through links, Escape closes and returns focus", async ({ page }) => {
  await page.goto("/about");
  const pill = page.getByRole("button", { name: "Demos", exact: true });
  await pill.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("link", { name: "Personal Library" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("link", { name: "Inventory Control" })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("link", { name: "Support Desk" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(pill).toHaveAttribute("aria-expanded", "false");
  await expect(pill).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(pill).toHaveAttribute("aria-expanded", "true");
});

test("a click outside closes the panel, and a link navigates and closes it", async ({ page }) => {
  await page.goto("/about");
  const pill = page.getByRole("button", { name: "Company", exact: true });
  await pill.click();
  await page.mouse.click(700, 600);
  await expect(pill).toHaveAttribute("aria-expanded", "false");
  await pill.click();
  await page.getByRole("link", { name: "Contact", exact: true }).first().click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByRole("button", { name: "Company", exact: true })).toHaveAttribute("aria-expanded", "false");
});

test("hovering a pill opens it; moving away closes it", async ({ page }) => {
  await page.goto("/about");
  const pill = page.getByRole("button", { name: "Product", exact: true });
  await pill.hover();
  await expect(pill).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("link", { name: "The repair loop" }).hover();
  await expect(pill).toHaveAttribute("aria-expanded", "true");
  await page.mouse.move(700, 700);
  await expect(pill).toHaveAttribute("aria-expanded", "false");
  // Hover then click pins it open, and a second click closes it.
  await pill.click();
  await expect(pill).toHaveAttribute("aria-expanded", "true");
  await page.mouse.move(700, 700);
  await expect(pill).toHaveAttribute("aria-expanded", "true");
  await pill.click();
  await expect(pill).toHaveAttribute("aria-expanded", "false");
});

test("the open pill turns ivory and the pill for the current page is marked", async ({ page }) => {
  await page.goto("/faq");
  const product = page.getByRole("button", { name: "Product", exact: true });
  await expect(product).toHaveAttribute("data-current", "");
  await expect(page.getByRole("button", { name: "Company", exact: true })).not.toHaveAttribute("data-current", "");
  await product.click();
  // On the ivory page bar the open pill inverts to ink, so it stays visible.
  await expect(product).toHaveCSS("background-color", "rgb(20, 20, 19)");
  await expect(page.locator("#lh-menu-product")).toHaveCSS("border-radius", "16px");
  // Over the dark landing hero it turns ivory, as on Fable.
  await page.goto("/");
  const onHero = page.getByRole("button", { name: "Product", exact: true });
  await onHero.click();
  await expect(onHero).toHaveCSS("background-color", "rgb(245, 243, 238)");
});

test("the bar stays in place while a menu is open, even when the page scrolls", async ({ page }) => {
  await page.goto("/faq");
  const bar = page.locator("[data-launch-header]");
  const before = await bar.boundingBox();
  const pill = page.getByRole("button", { name: "Company", exact: true });
  await pill.click();
  // A clicked panel is pinned: moving the pointer away leaves it open.
  await page.mouse.move(700, 700);
  await expect(pill).toHaveAttribute("aria-expanded", "true");
  await page.evaluate(() => window.scrollBy(0, 500));
  await expect.poll(async () => (await bar.boundingBox())!.y).toBeCloseTo(before!.y, 0);
});

test("phones get the same groups as sections inside the menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/about");
  await expect(page.locator(".lh-menus")).toBeHidden();
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const nav = page.getByRole("navigation", { name: "Mobile navigation" });
  for (const [label, links] of Object.entries(GROUPS)) {
    const section = nav.getByRole("region", { name: label });
    await expect(section.getByRole("link")).toHaveText(links);
  }
  await expect(nav.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("menu links sit on a compact 32px rhythm, like Fable's", async ({ page }) => {
  await page.goto("/about");
  await page.getByRole("button", { name: "Company", exact: true }).click();
  const links = page.locator("#lh-menu-company a");
  const [a, b] = await Promise.all([links.nth(0).boundingBox(), links.nth(1).boundingBox()]);
  expect(b!.y - a!.y).toBe(32);
});
