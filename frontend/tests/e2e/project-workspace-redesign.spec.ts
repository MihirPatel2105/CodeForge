import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

// The project page: a prompt studio beside a run history list.

const user = { id: "studio-user", email: "user@example.com", first_name: "Regular", last_name: "User", created_at: "2026-09-23T00:00:00Z", is_admin: false };
const project = { id: "studio-project", name: "Contact Directory", description: "Contacts", created_at: "2026-09-23T00:00:00Z", archived: false };
const stats = { total: 4, succeeded: 2, failed: 1, active: 1, avg_loops: 0.5, last: null };
const runs = [
  { id: "run-running", project_id: project.id, prompt: "Add a birthday field and filter favourites", status: "running", iterations: 1, parent_run_id: "run-passed", created_at: "2026-10-30T09:00:00Z", updated_at: "2026-10-30T09:01:04Z" },
  { id: "run-waiting", project_id: project.id, prompt: "Contacts with unique email and optional phone", status: "awaiting_approval", iterations: 0, created_at: "2026-10-30T08:00:00Z", updated_at: "2026-10-30T08:00:32Z" },
  { id: "run-passed", project_id: project.id, prompt: "Keep existing endpoints and add search by name", status: "succeeded", iterations: 1, created_at: "2026-10-04T17:42:00Z", updated_at: "2026-10-04T17:44:11Z" },
  { id: "run-failed", project_id: project.id, prompt: "Keep existing endpoints and add a phone format check", status: "failed_llm", iterations: 0, created_at: "2026-10-04T17:28:00Z", updated_at: "2026-10-04T17:28:20Z" },
];

async function openProject(page: Page, requests: URL[] = []) {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: { error: { code: "not_found", message: "Unavailable" } } }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: user }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
  await page.route(`**/api/backend/projects/${project.id}`, route => route.fulfill({ json: project }));
  await page.route(`**/api/backend/projects/${project.id}/runs/page*`, route => {
    requests.push(new URL(route.request().url()));
    return route.fulfill({ json: { items: runs, stats, next_cursor: null } });
  });
  await page.goto(`/projects/${project.id}`);
}

test("a template chip fills an empty prompt and asks before replacing a draft", async ({ page }) => {
  await openProject(page);
  const prompt = page.getByLabel("Describe the API");
  const templates = page.getByRole("group", { name: "Start from a template" });

  await templates.getByRole("button", { name: "Book library", exact: true }).click();
  await expect(prompt).toHaveValue(/books/);

  await prompt.fill("My own contacts prompt");
  await templates.getByRole("button", { name: "Inventory", exact: true }).click();
  await expect(prompt).toHaveValue("My own contacts prompt");
  await page.getByRole("button", { name: "Keep my draft", exact: true }).click();
  await expect(prompt).toHaveValue("My own contacts prompt");

  await templates.getByRole("button", { name: "Inventory", exact: true }).click();
  await page.getByRole("button", { name: "Replace draft", exact: true }).click();
  await expect(prompt).toHaveValue(/products/);
});

test("the keyboard shortcut starts a run", async ({ page }) => {
  await openProject(page);
  let body: Record<string, unknown> | null = null;
  await page.route("**/api/backend/runs", route => {
    body = route.request().postDataJSON();
    return route.fulfill({ status: 202, json: { run_id: "new-run", status: "running" } });
  });
  const prompt = page.getByLabel("Describe the API");
  await prompt.fill("Build a CRUD API for contacts");
  await prompt.press("ControlOrMeta+Enter");
  await expect(page).toHaveURL(/\/runs\/new-run$/);
  expect(body).toMatchObject({ project_id: project.id, prompt: "Build a CRUD API for contacts", rag_enabled: true });
});

test("run history shows one readable row per run, grouped by day", async ({ page }) => {
  await openProject(page);
  const list = page.getByRole("region", { name: "Run history list" });

  await expect(list.getByRole("link", { name: /^Open run:/ })).toHaveCount(4);
  await expect(list.getByRole("heading", { level: 3 })).toHaveText([/^(Today|Oct 30)$/, "Oct 4"]);

  const failed = list.getByRole("listitem").filter({ hasText: "phone format check" });
  await expect(failed.locator(".cf-run-outcome")).toHaveText("Providers unavailable");
  await expect(failed.locator(".cf-run-meta")).toContainText("20s");

  const passed = list.getByRole("listitem").filter({ hasText: "search by name" });
  await expect(passed.locator(".cf-run-outcome")).toHaveText("Passed");
  await expect(passed.locator(".cf-run-meta")).toContainText("1 repair loop");

  const improved = list.getByRole("listitem").filter({ hasText: "birthday field" });
  await expect(improved.getByRole("link", { name: "Improves an earlier run", exact: true })).toHaveAttribute("href", "/runs/run-passed");
});

test("the health strip summarises recent runs", async ({ page }) => {
  await openProject(page);
  const strip = page.getByRole("img", { name: /^Runs:/ });
  await expect(strip).toHaveAttribute("aria-label", "Runs: 2 passed, 1 failed, 1 other");
  await expect(page.locator(".cf-run-health-rate")).toHaveText("50% passed");
});

test("quick filters send the matching outcomes to the server", async ({ page }) => {
  const requests: URL[] = [];
  await openProject(page, requests);
  const filters = page.getByRole("group", { name: "Quick outcome filters" });

  await filters.getByRole("button", { name: /^Failed/ }).click();
  await expect(filters.getByRole("button", { name: /^Failed/ })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => requests.at(-1)?.searchParams.getAll("outcomes")).toEqual(["failed_max_loops", "failed_sandbox", "failed_llm"]);

  await filters.getByRole("button", { name: /^All/ }).click();
  await expect.poll(() => requests.at(-1)?.searchParams.has("outcomes") || requests.at(-1)?.searchParams.has("outcome")).toBe(false);
});

test("a row action reuses its prompt in the studio", async ({ page }) => {
  await openProject(page);
  const row = page.getByRole("listitem").filter({ hasText: "search by name" });
  await row.getByRole("button", { name: "Reuse prompt", exact: true }).click();
  await expect(page.getByLabel("Describe the API")).toHaveValue("Keep existing endpoints and add search by name");
});

for (const width of [1440, 375]) {
  test(`the redesigned page fits without horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openProject(page);
    await expect(page.getByLabel("Describe the API")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

for (const width of [1440, 375]) {
  test(`the redesigned page has no accessibility violations at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openProject(page);
    await expect(page.getByRole("region", { name: "Run history list" }).getByRole("link", { name: /^Open run:/ })).toHaveCount(4);
    await page.addScriptTag({ content: AXE });
    const violations = await page.evaluate(async () => {
      const result = await (window as unknown as { axe: { run: (context: Element) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe.run(document.querySelector("main")!);
      return result.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).slice(0, 3).join(", ")}`);
    });
    expect(violations).toEqual([]);
  });
}
