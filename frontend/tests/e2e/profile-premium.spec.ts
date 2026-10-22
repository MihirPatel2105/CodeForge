import { expect, test } from "@playwright/test";

for (const variant of ["desktop", "mobile", "dark", "reduced"] as const) {
  test(`premium profile fits ${variant} and links to account protection`, async ({ page }) => {
    await page.setViewportSize({ width: variant === "mobile" ? 375 : 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: variant === "reduced" ? "reduce" : "no-preference" });
    await page.addInitScript(() => document.cookie = "codeforge_session_present=1; Path=/");
    await page.route("**/api/backend/auth/me", route => route.fulfill({ json: {
      id: "profile-user", email: "user@example.com", first_name: "Regular", last_name: "User",
      created_at: "2026-09-23T00:00:00Z", is_admin: false, email_verified: true, totp_enabled: false,
    } }));
    await page.route("**/api/backend/projects", route => route.fulfill({ json: [] }));
    await page.goto("/profile");
    if (variant === "dark") await page.evaluate(() => document.documentElement.classList.add("dark"));
    await expect(page.getByRole("heading", { level: 1, name: "Regular User" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Manage two-factor" })).toHaveAttribute("href", "/profile/settings/2fa");
    await expect(page.getByText("Email verified", { exact: true })).toBeVisible();
    await expect(page.locator('dl[aria-label="Activity summary"]')).toHaveAttribute("aria-busy", "false");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(variant === "mobile" ? 375 : 1440);
    if (variant === "reduced") {
      const card = page.locator(".profile-premium-identity");
      await card.hover({ position: { x: 20, y: 20 } });
      await expect(card).toHaveCSS("transform", "none");
      await expect(page.locator(".profile-identity-stage")).toHaveCSS("animation-name", "none");
    }
    await page.screenshot({ path: `/tmp/codeforge-profile-premium-${variant}.png`, fullPage: true, animations: "disabled" });
  });
}
