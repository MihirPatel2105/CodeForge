import { expect, test, type Page } from "@playwright/test";

const user = { id: "workspace-user", email: "user@example.com", first_name: "Regular", last_name: "User", created_at: "2026-09-23T00:00:00Z", is_admin: false };
const project = { id: "workspace-project", name: "Library", description: "Books", created_at: "2026-09-23T00:00:00Z", archived: false };
const at = "2026-10-02T10:00:00Z";
const stats = { total: 1, succeeded: 1, failed: 0, active: 0, avg_loops: 0, last: null };
const run = { id: "workspace-run", project_id: project.id, prompt: "Build a library API", status: "succeeded", iterations: 0, created_at: at, updated_at: at, state: {}, metrics: { tests_passed: true } };
async function session(page: Page) {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: { error: { code: "not_found", message: "Unavailable" } } }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: user }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
}

test("templates, drafts, reuse, filters and project management", async ({ page }) => {
  await session(page);
  let current = { ...project };
  await page.route(`**/api/backend/projects/${project.id}`, async route => {
    if (route.request().method() === "PATCH") current = { ...current, ...route.request().postDataJSON() };
    await route.fulfill({ json: current });
  });
  await page.route(`**/api/backend/projects/${project.id}/runs/page*`, route => route.fulfill({ json: { items: new URL(route.request().url()).searchParams.get("q") ? [] : [run], stats, next_cursor: null } }));
  await page.goto(`/projects/${project.id}`);
  await page.getByLabel("Starter template").selectOption("0");
  await page.getByRole("button", { name: "Use template", exact: true }).click();
  await expect(page.getByLabel("Describe the API")).toHaveValue(/tasks/);
  await page.getByLabel("Describe the API").fill("My saved library prompt");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("codeforge:draft:workspace-user:workspace-project"))).toContain("My saved library prompt");
  await page.reload();
  await expect(page.getByLabel("Describe the API")).toHaveValue("My saved library prompt");
  await page.getByRole("button", { name: "Reuse prompt", exact: true }).click();
  await expect(page.getByLabel("Describe the API")).toHaveValue(run.prompt);
  await page.getByLabel("Search run prompts").fill("absent");
  await expect(page.getByText("No matching runs", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Describe the API")).toHaveValue(run.prompt);
  await page.getByRole("button", { name: "Manage project" }).click();
  await page.getByLabel("Project name", { exact: true }).fill("Renamed library");
  await page.getByRole("button", { name: "Archive project", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Renamed library" })).toBeVisible();
  expect(current.archived).toBe(true);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: "/tmp/codeforge-workspace-mobile.png", fullPage: true });
});

test("field mode, saved requests and ID reuse keep real request values", async ({ page }) => {
  await session(page);
  const operations = [
    { method: "POST", path: "/books", summary: "Create book", has_body: true, example_body: { title: "Book", count: 0 }, body_schema: { type: "object", properties: { title: { type: "string" }, count: { type: "integer" } }, required: ["title", "count"] } },
    { method: "GET", path: "/books/{book_id}", summary: "Get book", has_body: false, example_body: null },
  ];
  await page.route(`**/api/backend/runs/${run.id}/preview`, route => route.fulfill({ json: { operations, expires_after_seconds: 900, session_started: false } }));
  const sent: unknown[] = [];
  await page.route(`**/api/backend/runs/${run.id}/preview/request`, route => {
    sent.push(route.request().postDataJSON());
    return route.fulfill({ json: { status: 201, body: '{"id":"book-42","title":"New book"}', content_type: "application/json", duration_ms: 3, truncated: false, session_started: false } });
  });
  await page.goto(`/runs/${run.id}/try`);
  await page.getByRole("button", { name: "Fields", exact: true }).click();
  await page.getByLabel("title Required").fill("New book");
  await page.getByLabel("count Required").fill("invalid");
  await expect(page.getByRole("button", { name: "Send request" })).toBeDisabled();
  await page.getByLabel("count Required").fill("4");
  await page.getByRole("button", { name: "Save request", exact: true }).click();
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("HTTP 201 · 3 ms", { exact: true })).toBeVisible();
  expect(sent[0]).toEqual({ method: "POST", path: "/books", body: { title: "New book", count: 4 } });
  await page.getByLabel("Endpoint", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "Use this ID: book-42" }).click();
  await expect(page.getByLabel("Path", { exact: true })).toHaveValue("/books/book-42");
  await page.getByRole("button", { name: "Show CRUD walkthrough" }).click();
  await expect(page.getByText("1. POST: create a record", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "POST /books", exact: true }).click();
  await expect(page.getByLabel("JSON body")).toHaveValue(/New book/);
  await page.screenshot({ path: "/tmp/codeforge-tester.png", fullPage: true });
});

test("approval details request revisions without rejecting the run", async ({ page }) => {
  await session(page);
  await page.route(`**/api/backend/runs/${run.id}`, route => route.fulfill({ json: { ...run, status: "awaiting_approval" } }));
  const events = [
    { event: "run.started", run_id: run.id, prompt: run.prompt, at },
    { event: "approval.required", phase: "pm", payload: { project_name: "Library", entity: "Book", operations: "create, read", revisions_used: 0, details: { summary: "Manage books", entities: [{ name: "Book", fields: [{ name: "title", type: "str", required: true }] }] } }, at },
  ];
  await page.route(`**/api/backend/runs/${run.id}/stream`, route => route.fulfill({ contentType: "text/event-stream", body: events.map((event, i) => `id: ${i + 1}\ndata: ${JSON.stringify(event)}\n\n`).join("") }));
  let revision: unknown;
  await page.route(`**/api/backend/runs/${run.id}/revise`, route => { revision = route.request().postDataJSON(); return route.fulfill({ json: { run_id: run.id, status: "running" } }); });
  await page.goto(`/runs/${run.id}`);
  await expect(page.getByRole("cell", { name: "title", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Request changes", exact: true })).toBeDisabled();
  await page.getByLabel("Note to agents (optional)").fill("Add a due date");
  await page.getByRole("button", { name: "Request changes", exact: true }).click();
  expect(revision).toEqual({ phase: "pm", note: "Add a due date", expected_revision: 0 });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("list", { name: "Pipeline stages" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: "/tmp/codeforge-approval-mobile.png", fullPage: true });
});

test("completed runs create linked versions and surface inbox updates", async ({ page }) => {
  await session(page);
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [run] }));
  await page.route(`**/api/backend/runs/${run.id}`, route => route.fulfill({ json: run }));
  await page.route(`**/api/backend/runs/${run.id}/stream`, route => route.fulfill({ contentType: "text/event-stream", body: [
    { event: "run.started", run_id: run.id, prompt: run.prompt, at },
    { event: "run.completed", status: "succeeded", iterations: 0, at },
  ].map((event, i) => `id: ${i + 1}\ndata: ${JSON.stringify(event)}\n\n`).join("") }));
  let creation: unknown;
  await page.route("**/api/backend/runs", route => { creation = route.request().postDataJSON(); return route.fulfill({ json: { run_id: "new-version", status: "running" } }); });
  await page.goto(`/runs/${run.id}`);
  await page.getByRole("button", { name: /Run updates/ }).click();
  await expect(page.getByRole("dialog").getByText(run.prompt, { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByLabel("Describe a change", { exact: true }).fill("Add publication date");
  await page.getByRole("button", { name: "Build new version", exact: true }).click();
  await expect(page).toHaveURL(/runs\/new-version$/);
  expect(creation).toEqual({ project_id: project.id, parent_run_id: run.id, prompt: "Add publication date", rag_enabled: true });
});

test("version comparison shows changed files and source test evidence", async ({ page }) => {
  await session(page);
  await page.route(`**/api/backend/runs/${run.id}`, route => route.fulfill({ json: { ...run, parent_run_id: "source-run", change_request: "Add a year" } }));
  await page.route("**/api/backend/runs/source-run", route => route.fulfill({ json: { ...run, id: "source-run" } }));
  await page.route("**/api/backend/runs/source-run/files", route => route.fulfill({ json: { run_id: "source-run", files: [{ path: "main.py", content: "title = 'Book'\n" }] } }));
  await page.route(`**/api/backend/runs/${run.id}/files`, route => route.fulfill({ json: { run_id: run.id, files: [{ path: "main.py", content: "title = 'Book'\nyear = 2026\n" }] } }));
  await page.route(`**/api/backend/runs/${run.id}/stream`, route => route.fulfill({ contentType: "text/event-stream", body: [
    { event: "run.started", run_id: run.id, prompt: run.prompt, at },
    { event: "run.completed", status: "succeeded", iterations: 0, at },
  ].map((event, i) => `id: ${i + 1}\ndata: ${JSON.stringify(event)}\n\n`).join("") }));
  await page.goto(`/runs/${run.id}`);
  await expect(page.getByText("Source tests: Passed · This version: Tests passed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "1 changed files compared with source" }).click();
  await expect(page.getByText("+ year = 2026", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "the previous version" })).toHaveAttribute("href", "/runs/source-run");
});

async function revisedRun(page: Page) {
  await session(page);
  await page.route(`**/api/backend/runs/${run.id}`, route => route.fulfill({ json: { ...run, parent_run_id: "source-run", change_request: "Add a due date" } }));
  await page.route("**/api/backend/runs/source-run", route => route.fulfill({ json: { ...run, id: "source-run" } }));
  for (const id of [run.id, "source-run"]) {
    await page.route(`**/api/backend/runs/${id}/files`, route => route.fulfill({ json: { run_id: id, files: [] } }));
  }
  await page.route(`**/api/backend/runs/${run.id}/stream`, route => route.fulfill({ contentType: "text/event-stream", body: [
    { event: "run.started", run_id: run.id, prompt: run.prompt, at },
    { event: "run.completed", status: "succeeded", iterations: 0, at },
  ].map((event, i) => `id: ${i + 1}\ndata: ${JSON.stringify(event)}\n\n`).join("") }));
}

for (const status of ["breaking", "compatible", "needs_review"] as const) {
  test(`revision compatibility reports ${status} after an explicit check`, async ({ page }) => {
    await revisedRun(page);
    let checks = 0;
    await page.route(`**/api/backend/runs/${run.id}/compatibility`, route => {
      expect(route.request().method()).toBe("POST");
      checks += 1;
      return route.fulfill({ json: { status, checked_operations: 1, source_run_id: "source-run", checked_at: at, changes: status === "compatible" ? [] : [{ severity: status === "breaking" ? "breaking" : "needs_review", code: "required_added", operation: "POST /books", location: "Request body.due_date", message: "Review existing requests for this field." }] } });
    });
    await page.goto(`/runs/${run.id}`);
    const panel = page.getByRole("region", { name: "API compatibility", exact: true });
    await expect(panel.getByRole("button", { name: "Check compatibility", exact: true })).toBeVisible();
    expect(checks).toBe(0);
    await panel.getByRole("button", { name: "Check compatibility", exact: true }).click();
    const verdict = status === "breaking" ? "Breaking changes detected" : status === "compatible" ? "No breaking changes detected" : "Needs review";
    await expect(panel.getByRole("status")).toContainText(verdict);
    if (status !== "compatible") {
      await expect(panel.getByText("POST /books", { exact: true })).toBeVisible();
      await expect(panel.getByText("Request body.due_date", { exact: true })).toBeVisible();
    }
    await expect(panel.getByText(/Runtime behavior and data migrations/)).toBeVisible();
    await page.setViewportSize({ width: 375, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
}

test("compatibility shows loading, hides failed report and supports retry", async ({ page }) => {
  await revisedRun(page);
  let attempts = 0;
  let release: () => void = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/backend/runs/${run.id}/compatibility`, async route => {
    attempts += 1;
    if (attempts === 1) {
      await pending;
      return route.fulfill({ status: 503, json: { error: { code: "service_unavailable", message: "private socket details" } } });
    }
    return route.fulfill({ json: { status: "compatible", checked_operations: 1, changes: [], source_run_id: "source-run", checked_at: at } });
  });
  await page.goto(`/runs/${run.id}`);
  const panel = page.getByRole("region", { name: "API compatibility", exact: true });
  await panel.getByRole("button", { name: "Check compatibility", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Checking compatibility…", exact: true })).toBeDisabled();
  release();
  await expect(panel.getByText(/Could not check compatibility/)).toBeVisible();
  await expect(panel.getByText("private socket details")).toHaveCount(0);
  await panel.getByRole("button", { name: "Check compatibility", exact: true }).click();
  await expect(panel.getByRole("status")).toContainText("No breaking changes detected");
});

test("publish shows compatibility for a revision without starting checks or publication", async ({ page }) => {
  await revisedRun(page);
  await page.route(`**/api/backend/runs/${run.id}/deployment`, route => {
    expect(route.request().method()).toBe("GET");
    return route.fulfill({ status: 404, json: { error: { code: "not_found" } } });
  });
  await page.route(`**/api/backend/runs/${run.id}/preview`, route => route.fulfill({ json: { operations: [], expires_after_seconds: 900, session_started: false } }));
  await page.goto(`/runs/${run.id}/publish`);
  await expect(page.getByRole("region", { name: "API compatibility", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish API", exact: true })).toBeEnabled();
  await page.route(`**/api/backend/runs/${run.id}`, route => route.fulfill({ json: run }));
  await page.reload();
  await expect(page.getByRole("button", { name: "Publish API", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "API compatibility", exact: true })).toHaveCount(0);
});
