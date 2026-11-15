import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

// The projects index: a dense list ordered by activity, with filters, row actions,
// clickable run bars, a live refresh and list keys.

const user = { id: "index-user", email: "user@example.com", first_name: "Regular", last_name: "User", created_at: "2026-09-23T00:00:00Z", is_admin: false };

function run(id: string, projectId: string, status: string, day: number, prompt = `Prompt ${id}`) {
  const at = `2026-10-${String(day).padStart(2, "0")}T09:00:00Z`;
  return { id, project_id: projectId, prompt, status, iterations: 1, created_at: at, updated_at: at };
}

// Ten runs newest first: the latest five all pass, the five before mostly failed.
const contactRuns = [
  ...[29, 28, 27, 26, 25].map((day) => run(`c-${day}`, "contacts", "succeeded", day)),
  ...[24, 23, 22, 21].map((day) => run(`c-${day}`, "contacts", "failed_llm", day)),
  run("c-20", "contacts", "succeeded", 20),
];
contactRuns[0] = run("c-29", "contacts", "awaiting_approval", 29, "Add a birthday field");

function project(id: string, name: string, description: string, runs: ReturnType<typeof run>[], activity: string) {
  const finished = runs.filter((item) => !["queued", "running", "awaiting_approval"].includes(item.status));
  return {
    id, name, description, archived: false, created_at: "2026-09-30T00:00:00Z", last_activity_at: activity,
    recent_runs: runs,
    stats: {
      total: runs.length,
      succeeded: runs.filter((item) => item.status === "succeeded").length,
      failed: runs.filter((item) => item.status.startsWith("failed")).length,
      active: runs.length - finished.length,
      avg_loops: finished.length ? 1 : null,
      last: runs[0] ?? null,
    },
  };
}

const items = [
  project("contacts", "Contact Directory", "Names, phones and favourites", contactRuns, "2026-10-29T09:00:00Z"),
  project("events", "Community Event Planner", "", [run("e-1", "events", "succeeded", 12, "Events with RSVPs")], "2026-10-12T09:00:00Z"),
  project("inventory", "Inventory", "Stock levels", [], "2026-10-01T09:00:00Z"),
];

interface Mock {
  requests: URL[];
  patches: Record<string, unknown>[];
  overview?: (url: URL) => typeof items;
}

async function openProjects(page: Page, mock: Mock = { requests: [], patches: [] }) {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", (route) => route.fulfill({ status: 404, json: { error: { code: "not_found", message: "Unavailable" } } }));
  await page.route("**/api/backend/auth/me", (route) => route.fulfill({ json: user }));
  await page.route("**/api/backend/runs/attention", (route) => route.fulfill({ json: [contactRuns[0]] }));
  await page.route("**/api/backend/projects/overview*", (route) => {
    const url = new URL(route.request().url());
    mock.requests.push(url);
    const state = url.searchParams.get("state");
    const all = mock.overview ? mock.overview(url) : items;
    const shown = state === "failing" ? [] : state === "needs_you" ? all.slice(0, 1) : all;
    return route.fulfill({ json: { items: shown, next_cursor: null, total_projects: 3, matching_projects: shown.length, total_runs: 11, total_succeeded: 6 } });
  });
  await page.route("**/api/backend/projects/*", (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    const body = route.request().postDataJSON() as Record<string, unknown>;
    mock.patches.push(body);
    return route.fulfill({ json: { id: "contacts", created_at: "2026-09-30T00:00:00Z", ...body } });
  });
  await page.goto("/projects");
  await expect(page.locator("[data-project-link]")).toHaveCount(3);
}

const row = (page: Page, name: string) => page.locator("li.cf-project-row").filter({ hasText: name });

test("rows show state, run history, pass rate and trend in activity order", async ({ page }) => {
  await openProjects(page);
  await expect(page.locator("[data-project-link]")).toHaveText([/^Contact Directory/, /^Community Event Planner/, /^Inventory/]);

  const contacts = row(page, "Contact Directory");
  await expect(contacts).toContainText("Needs you");
  await expect(contacts.locator(".cf-heartbeat-bar")).toHaveCount(10);
  // 5 of 9 finished runs passed; the latest four all passed against 1 of the 5 before.
  await expect(contacts).toContainText("56%");
  await expect(contacts.getByText(/points up over the last 5 runs/)).toHaveCount(1);
  await expect(row(page, "Inventory")).toContainText("No runs");
  await expect(row(page, "Inventory")).toContainText("No runs yet");
});

test("a run bar names its run on hover and opens it on click", async ({ page }) => {
  await openProjects(page);
  const bar = row(page, "Community Event Planner").locator(".cf-heartbeat-bar");
  await bar.hover();
  await expect(page.locator(".cf-heartbeat-tip")).toContainText("Events with RSVPs");
  await bar.click();
  await expect(page).toHaveURL(/\/runs\/e-1$/);
});

test("status chips ask the server for the matching projects", async ({ page }) => {
  const mock: Mock = { requests: [], patches: [] };
  await openProjects(page, mock);
  const chips = page.getByRole("group", { name: "Filter by status" });

  await chips.getByRole("button", { name: "Needs you", exact: true }).click();
  await expect(chips.getByRole("button", { name: "Needs you", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => mock.requests.at(-1)?.searchParams.get("state")).toBe("needs_you");
  await expect(page.locator("[data-project-link]")).toHaveCount(1);
  await expect(page.getByRole("status").filter({ hasText: "shown" })).toHaveText("1 of 1 matching projects shown");

  await chips.getByRole("button", { name: "Failing", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No projects in this state" })).toBeVisible();
  await page.getByRole("button", { name: "Show all projects", exact: true }).click();
  await expect(page.locator("[data-project-link]")).toHaveCount(3);
  expect(mock.requests.at(-1)?.searchParams.has("state")).toBe(false);
});

test("the row menu renames and archives a project, with undo", async ({ page }) => {
  const mock: Mock = { requests: [], patches: [] };
  await openProjects(page, mock);

  await page.getByRole("button", { name: "Actions for Contact Directory", exact: true }).click();
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  const name = page.getByRole("dialog").getByLabel("Name", { exact: true });
  await name.fill("People Directory");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(mock.patches.at(-1)).toMatchObject({ name: "People Directory", archived: false });

  await page.getByRole("button", { name: "Actions for Contact Directory", exact: true }).click();
  await page.getByRole("menuitem", { name: "Archive", exact: true }).click();
  await expect.poll(() => mock.patches.at(-1)).toMatchObject({ name: "Contact Directory", archived: true });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => mock.patches.at(-1)).toMatchObject({ archived: false });
});

test("a run waiting for approval is called out above the list", async ({ page }) => {
  await openProjects(page);
  const strip = page.getByRole("region", { name: "Waiting for you" });
  await expect(strip).toContainText("1 run waits for your approval in Contact Directory");
  await expect(strip.getByRole("link", { name: "Review it" })).toHaveAttribute("href", "/runs/c-29");
});

test("a project with a running run refreshes until it finishes", async ({ page }) => {
  await page.clock.install();
  let finished = false;
  const running = project("events", "Community Event Planner", "", [run("e-2", "events", "running", 30)], "2026-10-30T09:00:00Z");
  const done = project("events", "Community Event Planner", "", [run("e-2", "events", "succeeded", 30)], "2026-10-30T09:00:00Z");
  const mock: Mock = { requests: [], patches: [], overview: () => [items[0], finished ? done : running, items[2]] };
  await openProjects(page, mock);
  await expect(row(page, "Community Event Planner")).toContainText("Running");

  finished = true;
  await page.clock.fastForward(5_100);
  await expect(row(page, "Community Event Planner")).toContainText("Passed");
  const requests = mock.requests.length;
  await page.clock.fastForward(10_200);
  expect(mock.requests.length).toBe(requests);
});

test("list keys move through projects and open the focused one", async ({ page }) => {
  await openProjects(page);
  await page.locator("body").press("/");
  await expect(page.getByRole("searchbox", { name: "Search projects" })).toBeFocused();
  await page.locator("h1").click();

  await page.keyboard.press("j");
  await expect(page.locator("[data-project-link]").nth(0)).toBeFocused();
  await page.keyboard.press("j");
  await expect(page.locator("[data-project-link]").nth(1)).toBeFocused();
  await page.keyboard.press("k");
  await expect(page.locator("[data-project-link]").nth(0)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/projects\/contacts$/);
});

test("project rows and cards show the name without an initials badge", async ({ page }) => {
  await openProjects(page);
  await expect(row(page, "Contact Directory").getByText("CD", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Grid layout", exact: true }).click();
  const tile = page.locator("li.cf-project-tile").filter({ hasText: "Contact Directory" });
  await expect(tile).toBeVisible();
  await expect(tile.getByText("CD", { exact: true })).toHaveCount(0);
});

test("the card menu deletes a project once its name is typed", async ({ page }) => {
  const deleted = new Set<string>();
  const mock: Mock = { requests: [], patches: [], overview: () => items.filter((item) => !deleted.has(item.id)) };
  await openProjects(page, mock);
  // Registered after openProjects: Playwright tries the newest route first, and the
  // helper's catch-all 404 would otherwise answer the DELETE.
  await page.route("**/api/backend/projects/events", (route) => {
    if (route.request().method() !== "DELETE") return route.fallback();
    deleted.add("events");
    return route.fulfill({ status: 204, body: "" });
  });

  await page.getByRole("button", { name: "Actions for Community Event Planner", exact: true }).click();
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this project?" });
  const submit = dialog.getByRole("button", { name: "Delete project", exact: true });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel("Type Community Event Planner to confirm").fill("Community Event Planner");
  await submit.click();

  await expect(dialog).toHaveCount(0);
  expect(deleted.has("events")).toBe(true);
  await expect(page.locator("[data-project-link]")).toHaveCount(2);
  await expect(page.getByText("Community Event Planner deleted")).toBeVisible();
});

test("the grid layout is remembered across visits", async ({ page }) => {
  await openProjects(page);
  await page.getByRole("button", { name: "Grid layout", exact: true }).click();
  await expect(page.locator("li.cf-project-tile")).toHaveCount(3);
  await page.reload();
  await expect(page.locator("li.cf-project-tile")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Grid layout", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("loading placeholders take the list's shape", async ({ page }) => {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", (route) => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", (route) => route.fulfill({ json: user }));
  await page.route("**/api/backend/projects/overview*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fulfill({ json: { items, next_cursor: null, total_projects: 3, matching_projects: 3, total_runs: 11, total_succeeded: 6 } });
  });
  await page.goto("/projects");
  const loading = page.getByLabel("Loading projects");
  await expect(loading).toBeVisible();
  await expect(loading.locator(":scope > div > .grid")).toHaveCount(4);
  await expect(page.locator("[data-project-link]")).toHaveCount(3);
});

for (const width of [1440, 375]) {
  test(`the projects index fits and passes an accessibility audit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openProjects(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.addScriptTag({ content: AXE });
    const violations = await page.evaluate(async () => {
      const result = await (window as unknown as { axe: { run: (context: Element) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe.run(document.querySelector("main")!);
      return result.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).slice(0, 3).join(", ")}`);
    });
    expect(violations).toEqual([]);
  });
}
