import { expect, test } from "@playwright/test";

for (const status of ["succeeded", "failed_sandbox", "cancelled"]) {
  test(`Agent City reports ${status} for the linked build`, async ({ page }) => {
    await page.clock.install();
    await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
    let requests = 0;
    await page.route("**/api/backend/runs/build-42", route => route.fulfill({ json: { id: "build-42", status: ++requests === 1 ? "running" : status } }));
    await page.goto("/playground/agent-city?run=build-42");
    await expect(page.getByRole("heading", { name: "Agent City" })).toBeVisible();
    await expect.poll(() => requests).toBe(1);
    const notice = page.getByRole("complementary", { name: "API build update" });
    await expect(notice).not.toBeVisible();
    await page.clock.runFor(5100);
    await expect(notice).toBeVisible();
    await expect(notice.getByRole("link")).toHaveAttribute("href", status === "succeeded" ? "/runs/build-42/use" : "/runs/build-42");
    await expect(notice).toContainText(status === "succeeded" ? "Your API is ready." : status === "cancelled" ? "Your build was cancelled." : "Your build needs a look.");
    await page.getByRole("button", { name: "Dismiss build update" }).click();
    await page.clock.runFor(20000);
    await expect(notice).not.toBeVisible();
    expect(requests).toBe(2);
  });
}

test("ordinary playground visits do not monitor unrelated runs", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/backend/runs/**", route => { requests++; return route.fulfill({ json: {} }); });
  await page.goto("/playground/agent-city");
  await expect(page.getByRole("heading", { name: "Agent City" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "API build update" })).not.toBeVisible();
  expect(requests).toBe(0);
});
