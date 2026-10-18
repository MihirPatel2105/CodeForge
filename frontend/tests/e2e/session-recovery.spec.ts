import { expect, test } from "@playwright/test";

const USER = {
  id: "recovery-user", email: "user@example.com", first_name: "Regular", last_name: "User",
  created_at: "2026-09-23T00:00:00Z", is_admin: false, email_verified: true, totp_enabled: false,
};

for (const failure of ["server", "network"]) {
  test(`${failure} account failure preserves the session and supports retry`, async ({ page }) => {
    await page.setViewportSize({ width: failure === "network" ? 390 : 1440, height: 900 });
    await page.addInitScript(() => document.cookie = "codeforge_session_present=1; Path=/");
    await page.route("**/api/backend/**", route => route.fulfill({ json: [] }));
    let reads = 0;
    await page.route("**/auth/me", route => {
      reads++;
      if (reads === 1) return failure === "network" ? route.abort("failed") : route.fulfill({
        status: 503, json: { error: { code: "service_unavailable", message: "Unavailable" } },
      });
      return route.fulfill({ json: USER });
    });
    await page.goto("/profile/settings/2fa");
    await expect(page.getByRole("button", { name: "Retry account" })).toBeVisible();
    await expect(page).toHaveURL(/\/profile\/settings\/2fa$/);
    expect(await page.evaluate(() => document.cookie.includes("codeforge_session_present=1"))).toBe(true);
    await page.getByRole("button", { name: "Retry account" }).click();
    await expect(page.getByText("Authenticator codes are off")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry account" })).toHaveCount(0);
    expect(reads).toBe(2);
  });
}

test("expired session still clears its marker and returns to sign-in", async ({ page }) => {
  await page.addInitScript(() => document.cookie = "codeforge_session_present=1; Path=/");
  await page.route("**/api/backend/**", route => route.fulfill({ json: [] }));
  await page.route("**/auth/me", route => route.fulfill({
    status: 401, json: { error: { code: "unauthorized", message: "Unauthorized" } },
  }));
  await page.goto("/profile/settings/2fa");
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => document.cookie.includes("codeforge_session_present=1"))).toBe(false);
});


test("a late retry response cannot restore a signed-out account", async ({ page }) => {
  await page.addInitScript(() => document.cookie = "codeforge_session_present=1; Path=/");
  await page.route("**/api/backend/**", route => route.fulfill({ json: [] }));
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let reads = 0;
  await page.route("**/auth/me", async route => {
    reads++;
    if (reads === 1) return route.fulfill({ status: 503, json: {} });
    await gate;
    return route.fulfill({ json: USER });
  });
  await page.goto("/profile/settings");
  await page.getByRole("button", { name: "Retry account" }).click();
  await expect.poll(() => reads).toBe(2);
  await page.evaluate(() => {
    document.cookie = "codeforge_session_present=; Path=/; Max-Age=0";
    window.dispatchEvent(new Event("codeforge-session-change"));
  });
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  const response = page.waitForResponse(response => response.url().endsWith("/auth/me"));
  release();
  await response;
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.cookie.includes("codeforge_session_present=1"))).toBe(false);
});
