import { expect, test } from "@playwright/test";

test("small screens show a dismissible notice that stays dismissed for the session", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const notice = page.getByRole("complementary", { name: "Screen size recommendation" });
  await expect(notice).toBeVisible();
  await expect(notice.getByRole("note")).toBeVisible();
  await expect(notice.getByRole("status")).toHaveCount(0);
  await expect(notice).toContainText("You can still browse on mobile.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: "/tmp/codeforge-desktop-recommendation-mobile.png" });
  await notice.getByRole("button", { name: "Dismiss desktop recommendation" }).click();
  await expect(notice).toHaveCount(0);
  await page.goto("/faq");
  await expect(notice).toHaveCount(0);
  await page.reload();
  await expect(notice).toHaveCount(0);
});

test("desktop hides the notice and resizing to a narrow screen reveals it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/faq");
  const notice = page.getByRole("complementary", { name: "Screen size recommendation" });
  await expect(notice).toBeHidden();
  await page.setViewportSize({ width: 767, height: 900 });
  await expect(notice).toBeVisible();
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(notice).toBeHidden();
});

test("dismissal works when session storage is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", { configurable: true, get: () => { throw new Error("Storage blocked"); } });
  });
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  await page.getByRole("button", { name: "Dismiss desktop recommendation" }).click();
  await expect(page.getByRole("complementary", { name: "Screen size recommendation" })).toHaveCount(0);
});
