import { expect, test } from "@playwright/test";

test("desktop stage cards stay complete and the FAQ is reachable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  const cards = page.locator("#how .el-card");
  await expect(cards).toHaveCount(6);
  for (const card of await cards.all()) {
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeVisible();
    await expect(card.locator(".el-rows > div").first()).toBeVisible();
  }
  await page.locator("#questions").scrollIntoViewIfNeeded();
  await expect(page.locator("#el-faq-title")).toBeInViewport();

  expect(errors).toEqual([]);
});

for (const mode of ["mobile", "reduced"] as const) {
  test(`${mode} keeps every stage accessible without sticky scrolling`, async ({ page }) => {
    await page.setViewportSize(mode === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    if (mode === "reduced") await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const cards = page.locator("#how .el-card");
    await expect(cards).toHaveCount(6);
    await cards.last().scrollIntoViewIfNeeded();
    await expect(cards.last().getByRole("heading", { name: "Sandbox", exact: true })).toBeVisible();
    await expect(cards.last()).toContainText("runs every test");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
