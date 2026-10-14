import { expect, test } from "@playwright/test";
import { screenGroups } from "../../components/redesign-preview/data";

const base = "/preview/redesign";
for (const width of [1440, 375]) {
  test(`every redesign screen renders at ${width}px without changing account data`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const backendRequests: string[] = [];
    const errors: string[] = [];
    page.on("request", request => { if (request.url().includes("/api/backend")) backendRequests.push(request.url()); });
    page.on("pageerror", error => errors.push(error.message));
    for (const [screen] of screenGroups.flatMap(group => group.screens)) {
      await page.goto(screen === "home" ? base : `${base}/${screen}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByLabel("Preview screen", { exact: true })).toHaveValue(screen);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), screen).toBeLessThanOrEqual(width);
      if (screen === "home" || screen === "projects" || screen === "run" || screen === "settings") {
        await page.screenshot({ path: `/tmp/codeforge-redesign-${screen}-${width}.png`, fullPage: screen === "home" ? false : true });
      }
    }
    expect(errors).toEqual([]);
    expect(backendRequests).toEqual([]);
  });
}

test("project search, local creation and modal focus work", async ({ page }) => {
  await page.goto(`${base}/projects`);
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Project name").fill("Reading Notes");
  await page.getByRole("button", { name: "Create preview project" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Search projects").fill("Reading Notes");
  await expect(page.getByRole("heading", { name: "Reading Notes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Personal Library", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "List view" }).click();
  await expect(page.getByRole("button", { name: "List view" })).toHaveAttribute("aria-pressed", "true");
});

test("saved runs stay completed, findings navigate to code and all lines scroll", async ({ page }) => {
  await page.goto(`${base}/run`);
  await expect(page.getByRole("heading", { name: "An idea, made tangible." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play walkthrough" })).toHaveCount(0);
  const scroll = page.locator(".rp-code-scroll");
  expect(await scroll.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
  expect(await scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(200);
  await page.getByRole("tab", { name: "Reviewer findings" }).click();
  await page.getByRole("button", { name: "schemas.py:5" }).click();
  await expect(page.getByRole("button", { name: "schemas.py", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".rp-highlight-line")).toContainText("title:");
});

test("walkthrough only plays on request and pauses for approval", async ({ page }) => {
  await page.goto(`${base}/run/live`);
  await expect(page.getByRole("heading", { name: "A team, ready to build." })).toBeVisible();
  await page.getByRole("button", { name: "Play walkthrough" }).click();
  await expect(page.getByRole("button", { name: "Approve sample requirements" })).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Approve sample requirements" }).click();
  await expect(page.getByRole("button", { name: "Approve sample plan" })).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Approve sample plan" }).click();
  await expect(page.getByRole("heading", { name: "An idea, made tangible." })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Reset walkthrough" }).click();
  await expect(page.getByRole("heading", { name: "A team, ready to build." })).toBeVisible();
});

test("API tester supports local POST, validation and encoded parameters", async ({ page }) => {
  await page.goto(`${base}/try`);
  await page.getByRole("button", { name: "POST Create book" }).click();
  await page.getByLabel("JSON request body").fill('{"title":"A new book","author":"Sample author"}');
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("201 Created", { exact: true })).toBeVisible();
  await expect(page.locator(".rp-response .rp-code-scroll")).toContainText("A new book");
  await page.getByLabel("JSON request body").fill("invalid json");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".rp-form-error")).toContainText("valid JSON");
  await page.getByRole("button", { name: "GET List books" }).click();
  await page.getByLabel("Enable parameter 1").check();
  await page.getByLabel("Parameter 1 value").fill("a & b");
  await expect(page.locator(".rp-request-address")).toContainText("read=a%20%26%20b");
});

test("mobile menu and command dialog navigate with keyboard and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`${base}/projects`);
  await page.getByRole("button", { name: "Open workspace navigation" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/redesign\/settings$/);
  await expect(page.getByRole("heading", { name: "Appearance", exact: true })).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+k");
  const search = page.getByLabel("Search preview screens");
  await search.fill("Integration kit");
  await expect(page.getByRole("dialog").getByRole("link", { name: "Integration kit" })).toBeVisible();
  await search.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/redesign\/use$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
