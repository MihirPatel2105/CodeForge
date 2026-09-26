import { expect, test } from "@playwright/test";

test("sign-up moves to email verification after a valid registration", async ({ page }) => {
  let registration: Record<string, string> | null = null;
  await page.route("**/auth/register", async (route) => {
    registration = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        verification_required: true,
        email: "new@example.com",
        expires_at: new Date(Date.now() + 600_000).toISOString(),
      }),
    });
  });

  await page.goto("/signup");
  await page.getByLabel("First name").fill("New");
  await page.getByLabel("Email").fill("new@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Strongpass1");
  await page.getByRole("button", { name: "Create account", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Verification code" })).toBeVisible();
  expect(registration).toMatchObject({ first_name: "New", email: "new@example.com", password: "Strongpass1" });
});
