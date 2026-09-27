import { expect, test } from "@playwright/test";

const USER = {
  id: "507f1f77bcf86cd799439012",
  email: "user@example.com",
  first_name: "Regular",
  last_name: "User",
  created_at: "2026-09-23T00:00:00Z",
  is_admin: false,
  email_verified: true,
  totp_enabled: true,
};

const ADMIN = {
  ...USER,
  id: "507f1f77bcf86cd799439011",
  email: "operator@example.com",
  first_name: "CodeForge",
  last_name: "Admin",
  is_admin: true,
};

test("development proxy accepts the requested LAN origin and rejects a foreign origin", async ({ request }) => {
  const host = "192.168.31.7:3001";
  const sameOrigin = await request.post("/api/backend/health", {
    headers: { Host: host, Origin: `http://${host}` },
    data: {},
  });
  expect(sameOrigin.status()).toBe(405);

  const foreignOrigin = await request.post("/api/backend/health", {
    headers: { Host: host, Origin: "http://evil.example" },
    data: {},
  });
  expect(foreignOrigin.status()).toBe(403);
});

test("password sign-in sends a device ID when randomUUID is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, "randomUUID", { value: undefined, configurable: true });
  });
  let deviceId: string | null = null;
  await page.route("**/auth/login", (route) => {
    deviceId = route.request().headers()["x-codeforge-device"] ?? null;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access_token: null, token_type: "bearer", mfa_required: true, mfa_ticket: "test-ticket", mfa_methods: ["totp"] }),
    });
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill(USER.email);
  await page.getByLabel("Password", { exact: true }).fill("correct-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/login\/verify$/);
  expect(deviceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("password sign-in offers both saved methods and completes with an authenticator code", async ({ page }) => {
  await page.route("**/auth/login", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ access_token: null, token_type: "bearer", mfa_required: true, mfa_ticket: "test-ticket", mfa_methods: ["totp", "passkey"] }),
  }));
  await page.route("**/auth/me", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(USER) }));
  await page.route("**/auth/login/complete", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: "verified-token", token_type: "bearer" }) }));

  await page.goto("/login");
  await page.getByLabel("Email").fill(USER.email);
  await page.getByLabel("Password", { exact: true }).fill("correct-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/login\/verify$/);
  await expect(page.getByRole("heading", { name: "Verify yourself" })).toBeVisible();
  const methodGroup = page.getByRole("group", { name: "Verification method" });
  await methodGroup.getByRole("button", { name: "Passkey" }).click();
  await expect(page.getByRole("button", { name: "Verify with passkey" })).toBeVisible();
  await methodGroup.getByRole("button", { name: "Authenticator code" }).click();
  await page.getByLabel("Authenticator code").fill("123456");
  const request = page.waitForRequest((item) => item.url().endsWith("/auth/login/complete") && item.method() === "POST");
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  expect(JSON.parse((await request).postData() ?? "null")).toEqual({ ticket: "test-ticket", totp_code: "123456" });
  await expect(page).toHaveURL(/\/projects$/);
  expect(await page.evaluate(() => localStorage.getItem("codeforge_token"))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem("codeforge_password_mfa"))).toBeNull();
});

test("passkey-only verification does not show a code field", async ({ page }) => {
  await page.route("**/auth/login", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ access_token: null, token_type: "bearer", mfa_required: true, mfa_ticket: "test-ticket", mfa_methods: ["passkey"] }),
  }));
  await page.goto("/login");
  await page.getByLabel("Email").fill(USER.email);
  await page.getByLabel("Password", { exact: true }).fill("correct-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login\/verify$/);
  await expect(page.getByRole("button", { name: "Verify with passkey" })).toBeVisible();
  await expect(page.getByLabel("Authenticator code")).toHaveCount(0);
});

test("administrator can choose passkey or code and code verification opens admin", async ({ page }) => {
  await page.route("**/auth/login", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ access_token: null, token_type: "bearer", mfa_required: true, mfa_ticket: "admin-ticket", mfa_methods: ["totp", "passkey"] }),
  }));
  await page.route("**/auth/me", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ADMIN) }));
  await page.route("**/auth/login/complete", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: "admin-token", token_type: "bearer" }) }));

  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill("correct-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/login\/verify$/);
  const methodGroup = page.getByRole("group", { name: "Verification method" });
  await expect(methodGroup.getByRole("button", { name: "Authenticator code" })).toBeVisible();
  await methodGroup.getByRole("button", { name: "Passkey" }).click();
  await expect(page.getByRole("button", { name: "Verify with passkey" })).toBeVisible();
  await methodGroup.getByRole("button", { name: "Authenticator code" }).click();
  await page.getByLabel("Authenticator code").fill("654321");
  await page.getByRole("button", { name: "Verify and sign in" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  expect(await page.evaluate(() => localStorage.getItem("codeforge_token"))).toBeNull();
});

test("verification page cannot be opened without a pending password sign-in", async ({ page }) => {
  await page.goto("/login/verify");
  await expect(page).toHaveURL(/\/login$/);
});
