import { expect, test } from "@playwright/test";

test("cancelled passkey prompt shows a calm retry message", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "PublicKeyCredential", {
      configurable: true,
      value: class PublicKeyCredential {},
    });
    Object.defineProperty(navigator.credentials, "get", {
      configurable: true,
      value: async () => {
        throw new DOMException(
          "The operation was not allowed. See: https://example.test/internal-detail",
          "NotAllowedError",
        );
      },
    });
  });
  await page.route("**/api/backend/auth/passkeys/login/options", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ challenge_id: "test-challenge", options: { challenge: "AA", rpId: "localhost" } }),
    }),
  );

  await page.goto("/login/passkey");
  await page.getByRole("button", { name: "Continue with passkey" }).click();

  await expect(page.getByRole("status")).toContainText("Passkey check wasn't completed");
  await expect(page.getByRole("button", { name: "Continue with passkey" })).toBeEnabled();
  await expect(page.getByText("https://example.test/internal-detail")).toHaveCount(0);
  await expect(page.locator("main [role='alert']")).toHaveCount(0);
});

test("server error details never appear in a sign-in alert", async ({ page }) => {
  await page.route("**/api/backend/auth/login", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "internal_error",
          message: "database://service:secret-password@private-host/internal-error",
        },
      }),
    }),
  );

  await page.goto("/login");
  await page.getByLabel("Email").fill("person@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Strongpass1");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.locator("main [role='alert']")).toContainText("Something went wrong on our side");
  await expect(page.getByText("secret-password")).toHaveCount(0);
});
