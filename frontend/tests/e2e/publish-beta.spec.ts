import { expect, test } from "@playwright/test";

test("publishing requires Beta acknowledgement and cancellation sends no request", async ({ page }) => {
  const id = "beta-run";
  let publications = 0;
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "user", email: "user@example.com", first_name: "Test" } }));
  await page.route(`**/api/backend/runs/${id}`, route => route.fulfill({ json: { id, status: "succeeded", state: {} } }));
  await page.route(`**/api/backend/runs/${id}/preview`, route => route.fulfill({ json: { operations: [] } }));
  await page.route(`**/api/backend/runs/${id}/deployment`, route => {
    if (route.request().method() === "GET") return route.fulfill({ status: 404, json: {} });
    publications++;
    return route.fulfill({ status: 201, json: { id: "deployment", run_id: id, url: "https://example.com/api", key_prefix: "cf_live_test", api_key: "cf_live_test", status: "active", created_at: "2026-10-23T00:00:00Z" } });
  });
  await page.goto(`/runs/${id}/publish`);
  await page.getByRole("button", { name: "Publish API", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Publish API — Beta" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Public API hosting is in Beta");
  expect(publications).toBe(0);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(publications).toBe(0);
  await page.getByRole("button", { name: "Publish API", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(publications).toBe(0);
  await page.getByRole("button", { name: "Publish API", exact: true }).click();
  await dialog.getByRole("button", { name: "Continue and publish", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Connection details" })).toBeVisible();
  expect(publications).toBe(1);
});
