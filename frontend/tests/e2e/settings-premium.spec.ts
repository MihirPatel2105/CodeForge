import { expect, test } from "@playwright/test";

for (const variant of ["desktop", "mobile", "dark", "reduced", "admin"] as const) {
  test(`premium settings preserves account controls for ${variant}`, async ({ page }) => {
    const width = variant === "mobile" ? 375 : 1440;
    await page.setViewportSize({ width, height: 1100 });
    await page.emulateMedia({ reducedMotion: variant === "reduced" ? "reduce" : "no-preference" });
    await page.addInitScript(() => document.cookie = "codeforge_session_present=1; Path=/");
    await page.route("**/api/backend/auth/me", route => route.fulfill({ json: {
      id: "settings-user", email: "user@example.com", first_name: "Regular", last_name: "User",
      created_at: "2026-09-23T00:00:00Z", is_admin: variant === "admin", email_verified: true, totp_enabled: variant === "admin",
    } }));
    await page.route("**/api/backend/auth/devices", route => route.fulfill({ json: [] }));
    await page.goto("/profile/settings");
    await expect(page.getByRole("heading", { level: 1, name: variant === "admin" ? "Admin settings" : "Settings" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Change password", exact: true })).toHaveAttribute("href", "/profile/settings/password");
    await expect(page.getByRole("link", { name: "Manage passkeys", exact: true })).toHaveAttribute("href", "/profile/settings/passkeys");
    // The app forces light mode here; apply dark styling after hydration to check its fallback palette.
    if (variant === "dark") {
      await page.evaluate(() => document.documentElement.classList.add("dark"));
      expect(await page.locator(".account-workspace").evaluate(element => {
        const shared = getComputedStyle(document.documentElement);
        const account = getComputedStyle(element);
        return account.getPropertyValue("--accent").trim() === shared.getPropertyValue("--accent").trim()
          && account.getPropertyValue("--bg").trim() === shared.getPropertyValue("--bg").trim();
      })).toBe(true);
    }
    await page.screenshot({ path: `/tmp/codeforge-settings-premium-${variant}.png`, fullPage: true, animations: "disabled" });
    const rail = page.getByRole("navigation", { name: "Settings sections" });
    for (const [label, id] of [["Sessions and devices", "sessions"], ["Account", "account"], ["Sign-in methods", "sign-in-methods"], ["Account", "account"]]) {
      const link = rail.getByRole("link", { name: label, exact: true });
      await link.click();
      await expect(link).toHaveAttribute("aria-current", "location");
      await expect.poll(() => page.locator(`#${id}`).evaluate(element => {
        const top = element.getBoundingClientRect().top;
        return (top >= 60 && top <= 104) || (Math.abs(scrollY + innerHeight - document.documentElement.scrollHeight) < 4 && top >= 0 && top < innerHeight);
      })).toBe(true);
      await expect(link).toHaveAttribute("aria-current", "location");
    }
    if (variant === "admin") {
      await expect(page.getByText("Administrator deletion is disabled")).toBeVisible();
      await expect(page.getByRole("button", { name: "Protected", exact: true })).toBeDisabled();
    } else {
      await expect(page.getByRole("button", { name: "Delete account", exact: true })).toBeVisible();
    }
    await expect(page.locator(".cf-settings-layout")).toHaveCSS("display", variant === "mobile" ? "block" : "grid");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (variant === "reduced") await expect(page.locator('.settings-premium-panel').first()).toHaveCSS("animation-name", "none");
  });
}

for (const width of [1440, 375]) {
  test(`security subpages retain premium chrome and fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => document.cookie = "codeforge_session_present=1; Path=/");
    await page.route("**/api/backend/auth/me", route => route.fulfill({ json: {
      id: "settings-user", email: "user@example.com", first_name: "Regular", last_name: "User",
      created_at: "2026-09-23T00:00:00Z", is_admin: false, email_verified: true, totp_enabled: false,
    } }));
    await page.route("**/api/backend/auth/passkeys", route => route.fulfill({ json: [] }));
    for (const [path, heading] of [["password", "Change your password"], ["passkeys", "Passkeys"], ["2fa", "Two-factor authentication"]]) {
      await page.goto(`/profile/settings/${path}`);
      await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Back to settings", exact: true })).toHaveAttribute("href", "/profile/settings");
      // The switcher is a row of underlined text tabs, and the page head is a serif title on the
      // page rather than a tinted card.
      const nav = page.getByRole("navigation", { name: "Security settings" });
      await expect(nav.locator('a[aria-current="page"]')).toHaveCSS("border-bottom-width", "2px");
      await expect(nav).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      const hero = page.locator("header.cf-account-hero");
      await expect(hero).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      expect(await hero.locator("h1").evaluate(element => getComputedStyle(element).fontFamily)).toContain("Newsreader");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  });
}
