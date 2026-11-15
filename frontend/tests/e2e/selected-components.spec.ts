import { expect, test } from "@playwright/test";

test("homepage explanation link works without hover previews or the removed search block", async ({ page }) => {
  await page.goto("/");
  // "How it works" now lives in the Product menu.
  await page.getByRole("banner").getByRole("button", { name: "Product", exact: true }).click();
  const link = page.getByRole("banner").getByRole("link", { name: "How it works", exact: true });
  await link.hover();
  await expect(page.locator("[data-slot=hover-card-trigger], [data-slot=hover-card-content]")).toHaveCount(0);
  await expect(link).toHaveAttribute("href", "/how-it-works");
  await link.click();
  await expect(page).toHaveURL(/\/how-it-works$/);
  await page.goto("/");
  await expect(page.getByRole("searchbox", { name: "Search example APIs", exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const cta = page.getByRole("banner").getByRole("link", { name: "Get started", exact: true });
  await cta.hover();
  await expect(cta).toHaveAttribute("href", "/signup");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("run outcomes combine, search, and remove without losing pagination filters", async ({ page }) => {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "preview", first_name: "Preview", is_admin: false } }));
  await page.route("**/api/backend/projects/filters", route => route.fulfill({ json: { id: "filters", name: "Library", created_at: "2026-10-14T08:00:00Z", archived: false } }));
  const requests: URL[] = [];
  await page.route("**/api/backend/projects/filters/runs/page*", route => {
    const url = new URL(route.request().url()); requests.push(url);
    return route.fulfill({ json: { items: [], stats: { total: 10, succeeded: 4, failed: 2, avg_loops: 1 }, next_cursor: url.searchParams.has("cursor") ? null : "next-page" } });
  });
  await page.goto("/projects/filters");
  const input = page.getByRole("combobox", { name: "Filter run outcomes" });
  await input.fill("suc");
  await page.getByRole("option", { name: "succeeded", exact: true }).click();
  await input.fill("sandbox");
  await page.getByRole("option", { name: /sandbox/ }).click();
  await input.press("Escape");
  await expect.poll(() => requests.at(-1)?.searchParams.getAll("outcomes")).toEqual(["succeeded", "failed_sandbox"]);
  await page.getByRole("button", { name: "Load more runs" }).click();
  await expect.poll(() => requests.at(-1)?.searchParams.get("cursor")).toBe("next-page");
  expect(requests.at(-1)?.searchParams.getAll("outcomes")).toEqual(["succeeded", "failed_sandbox"]);
  await page.screenshot({ path: "/tmp/codeforge-outcome-filter.png", fullPage: true });
  await page.getByRole("button", { name: "Remove succeeded", exact: true }).click();
  await expect.poll(() => requests.at(-1)?.searchParams.get("outcome")).toBe("failed_sandbox");
  expect(requests.at(-1)?.searchParams.has("cursor")).toBe(false);
  await input.fill("suc");
  await input.press("ArrowDown"); await input.press("Enter");
  await expect.poll(() => requests.at(-1)?.searchParams.getAll("outcomes")).toEqual(["failed_sandbox", "succeeded"]);
});
