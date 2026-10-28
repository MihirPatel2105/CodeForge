import { expect, test, type Page } from "@playwright/test";
import { OrthographicCamera, Vector3 } from "three";
import { getDemoRun } from "../../lib/demo-runs";

const runId = "city-live-42";
const prompt = "Build a books API with title and author filtering";
const baseTime = Date.parse("2026-10-27T08:00:00Z");
type CityEvent = Record<string, unknown>;

const start: CityEvent[] = [
  { event: "run.started", run_id: runId, prompt },
  { event: "agent.started", agent: "pm", iteration: 0 },
  { event: "agent.message", agent: "pm", text: "Books requirements evidence: preserve author filtering." },
  { event: "agent.completed", agent: "pm", output_summary: { entities: 1, operations: 4 }, duration_ms: 1200 },
  { event: "approval.required", phase: "pm", payload: { project_name: "Books requirements evidence", entities: [{ name: "Book", fields: [{ name: "title", type: "str", required: true }, { name: "author", type: "str", required: true }] }] } },
];

const coding: CityEvent[] = [
  { event: "approval.resolved", phase: "pm", approved: true },
  { event: "agent.started", agent: "architect", iteration: 0 },
  { event: "agent.completed", agent: "architect", output_summary: { endpoints: 5, collections: 1 }, duration_ms: 1400 },
  { event: "approval.resolved", phase: "architect", approved: true },
  { event: "agent.started", agent: "coder", iteration: 0 },
  { event: "agent.message", agent: "coder", text: "Writing the author filtering route." },
  { event: "file.written", path: "main.py", bytes: 93 },
];

const repair: CityEvent[] = [
  { event: "agent.completed", agent: "coder", output_summary: { files: 1 }, duration_ms: 2000 },
  { event: "agent.started", agent: "reviewer", iteration: 0 },
  { event: "agent.message", agent: "reviewer", text: "main.py: Author filtering currently returns books from both authors." },
  { event: "agent.completed", agent: "reviewer", output_summary: { findings: 1, blocking: 1, passed: false }, duration_ms: 1200 },
  { event: "loop.iteration", iteration: 1, trigger: "reviewer", blocking_findings: 1, failed_tests: 0 },
  { event: "agent.started", agent: "coder", iteration: 1 },
];

const finish: CityEvent[] = [
  { event: "file.written", path: "main.py", bytes: 118 },
  { event: "agent.completed", agent: "coder", output_summary: { files: 1, changelog: ["Applied author filtering"] }, duration_ms: 1800 },
  { event: "agent.started", agent: "reviewer", iteration: 1 },
  { event: "agent.completed", agent: "reviewer", output_summary: { findings: 0, blocking: 0, passed: true }, duration_ms: 900 },
  { event: "agent.started", agent: "tester", iteration: 1 },
  { event: "file.written", path: "test_main.py", bytes: 54 },
  { event: "agent.completed", agent: "tester", output_summary: { tests: 4 }, duration_ms: 1000 },
  { event: "sandbox.started", image: "codeforge-sandbox:latest" },
  { event: "sandbox.output", stream: "stdout", chunk: "test_author_filter PASSED\n4 passed in 0.21s\n" },
  { event: "tests.result", passed: true, total: 4, failed: 0 },
  { event: "run.completed", status: "succeeded", iterations: 1, duration_ms: 18000 },
];

function timed(events: CityEvent[], offset = 0): (CityEvent & { at: string })[] {
  return events.map((event, index) => ({ ...event, at: new Date(baseTime + (index + offset) * 1000).toISOString() }));
}

async function installCity(page: Page, events: CityEvent[] = start, status = "running", networkStream = false) {
  const writes: string[] = [];
  page.on("request", request => {
    if (request.url().includes("/api/backend/") && !["GET", "HEAD"].includes(request.method())) writes.push(request.url());
  });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: { error: { code: "not_found", message: "Unavailable" } } }));
  await page.route(`**/api/backend/runs/${runId}`, route => route.fulfill({ json: {
    id: runId, project_id: "city-project", prompt, status, iterations: 1, created_at: new Date(baseTime).toISOString(), updated_at: new Date(baseTime).toISOString(), metrics: null,
    state: {
      requirements: { project_name: "Books requirements evidence", entities: [{ name: "Book", fields: [{ name: "title", type: "str" }, { name: "author", type: "str" }] }] },
      design: { endpoints: [{ method: "GET", path: "/books", description: "Filter books by author" }] },
      review: { passed: true, findings: [] },
      tests: { passed: true, total: 4, failed: 0 },
    },
  } }));
  await page.route(`**/api/backend/runs/${runId}/files`, route => route.fulfill({ json: { run_id: runId, files: [
    { path: "main.py", content: "def filter_books_by_author(author):\n    return [book for book in books if book.author == author]\n" },
    { path: "test_main.py", content: "def test_author_filter():\n    assert author_filter_is_applied\n" },
  ] } }));
  await page.addInitScript(({ id, events, networkStream }) => {
    document.cookie = "codeforge_session_present=1; Path=/";
    const original = window.fetch.bind(window);
    let wireEvents: Record<string, unknown>[] = events;
    window.fetch = (input, init) => {
      if (networkStream || !String(input).endsWith(`/runs/${id}/stream`)) return original(input, init);
      const after = Number(new Headers(init?.headers).get("Last-Event-ID") || 0);
      const stream = new ReadableStream({
        start(controller) {
          function emit(next: Record<string, unknown>[], offset: number) {
            if (next.length) controller.enqueue(new TextEncoder().encode(next.map((event, index) => `id: ${offset + index + 1}\ndata: ${JSON.stringify(event)}\n\n`).join("")));
          }
          emit(wireEvents.slice(after), after);
          function append(event: Event) {
            const incoming = (event as CustomEvent<Record<string, unknown>[]>).detail;
            const offset = wireEvents.length;
            wireEvents = [...wireEvents, ...incoming];
            emit(incoming, offset);
          }
          window.addEventListener("append-city-events", append);
          init?.signal?.addEventListener("abort", () => {
            window.removeEventListener("append-city-events", append);
            controller.error(new DOMException("Aborted", "AbortError"));
          }, { once: true });
        },
      });
      return Promise.resolve(new Response(stream, { headers: { "Content-Type": "text/event-stream" } }));
    };
  }, { id: runId, events: timed(events), networkStream });
  return writes;
}

async function appendEvents(page: Page, events: CityEvent[], offset: number) {
  await page.evaluate(events => window.dispatchEvent(new CustomEvent("append-city-events", { detail: events })), timed(events, offset));
}

test("live city follows the real pipeline and leaves approvals on the run screen", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const writes = await installCity(page);
  await page.goto(`/playground/agent-city?run=${runId}`);
  await expect(page.getByRole("heading", { name: "Agent City", exact: true })).toBeVisible();
  await expect(page.locator('[data-city-stage="pm"]')).toHaveAttribute("data-state", "done");
  await expect(page.getByRole("link", { name: "Review checkpoint" })).toHaveAttribute("href", `/runs/${runId}`);
  await appendEvents(page, coding, start.length);
  await expect(page.locator('[data-city-stage="coder"]')).toHaveAttribute("data-state", "working");
  await expect(page.getByRole("button", { name: "Inspect Coder", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Inspect PM", exact: true }).click();
  await expect(page.getByRole("button", { name: "Follow active agent", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("region", { name: "Stage evidence", exact: true })).toContainText("Books requirements evidence");
  await appendEvents(page, repair, start.length + coding.length);
  await expect(page.locator('[data-city-stage="coder"]')).toHaveAttribute("data-state", "working");
  await expect(page.getByRole("button", { name: "Inspect PM", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Follow active agent", exact: true }).click();
  await expect(page.getByRole("button", { name: "Inspect Coder", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Inspect Reviewer", exact: true }).click();
  await expect(page.getByRole("region", { name: "Stage evidence", exact: true })).toContainText("Author filtering currently returns books from both authors.");
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test("recorded repair replay scrubs without rerunning the API or leaking future work", async ({ page }) => {
  const events = [...start, ...coding, ...repair, ...finish];
  const writes = await installCity(page, events, "succeeded");
  await page.goto(`/playground/agent-city?run=${runId}`);
  await expect(page.locator('[data-city-stage="sandbox"]')).toHaveAttribute("data-state", "done");
  await page.getByRole("button", { name: "Inspect Coder", exact: true }).click();
  await expect(page.getByRole("region", { name: "Stage evidence", exact: true })).toContainText("main.py");
  await page.getByRole("region", { name: "Stage evidence", exact: true }).getByRole("button", { name: "main.py", exact: true }).click();
  await expect(page.getByLabel("main.py source code", { exact: true })).toContainText("filter_books_by_author");
  await page.getByRole("button", { name: "Replay run", exact: true }).click();
  const position = page.getByRole("slider", { name: "Replay position", exact: true });
  await position.fill("0");
  await expect(page.locator('[data-city-stage="coder"]')).toHaveAttribute("data-state", "idle");
  await page.getByRole("button", { name: "Inspect Coder", exact: true }).click();
  await expect(page.getByRole("region", { name: "Stage evidence", exact: true })).not.toContainText("filter_books_by_author");
  await page.getByRole("button", { name: "Return to live", exact: true }).click();
  await expect(page.locator('[data-city-stage="sandbox"]')).toHaveAttribute("data-state", "done");
  expect(writes).toEqual([]);
});

test("inaccessible run stops with a useful retry and recovers on demand", async ({ page }) => {
  await installCity(page, [...start, ...coding]);
  let blocked = true;
  let reads = 0;
  await page.route(`**/api/backend/runs/${runId}`, route => {
    reads++;
    return blocked
      ? route.fulfill({ status: 404, json: { error: { code: "not_found", message: "Run not found" } } })
      : route.fulfill({ json: { id: runId, project_id: "city-project", prompt, status: "running", state: {}, metrics: null, created_at: new Date(baseTime).toISOString(), updated_at: new Date(baseTime).toISOString() } });
  });
  await page.goto(`/playground/agent-city?run=${runId}`);
  await expect(page.getByRole("button", { name: "Retry connection", exact: true })).toBeVisible();
  await expect(page.locator(".live-agent-city").getByRole("alert")).toContainText(/not found|unavailable|access/i);
  const failedReads = reads;
  await page.waitForTimeout(1400);
  expect(reads).toBe(failedReads);
  blocked = false;
  await page.getByRole("button", { name: "Retry connection", exact: true }).click();
  await expect(page.locator('[data-city-stage="coder"]')).toHaveAttribute("data-state", "working");
});

test("archived history resumes after EOF and never presents replayed work as live", async ({ page }) => {
  const events = [...start, ...coding, ...repair, ...finish];
  await installCity(page, events, "succeeded", true);
  const split = start.length + coding.length;
  let connections = 0;
  const resumedIds: string[] = [];
  let releaseResume: () => void = () => {};
  const resume = new Promise<void>(resolve => { releaseResume = resolve; });
  await page.route(`**/api/backend/runs/${runId}/stream`, async route => {
    connections++;
    resumedIds.push(route.request().headers()["last-event-id"] ?? "");
    const from = connections === 1 ? 0 : split - 1;
    const chunk = connections === 1 ? timed(events).slice(0, split) : timed(events).slice(from);
    if (connections > 1) await resume;
    return route.fulfill({ contentType: "text/event-stream", body: chunk.map((event, index) => `id: ${from + index + 1}\ndata: ${JSON.stringify(event)}\n\n`).join("") });
  });
  await page.goto(`/playground/agent-city?run=${runId}`);
  await expect.poll(() => connections).toBe(2);
  await expect(page.locator('[data-city-stage="coder"]')).toHaveAttribute("data-state", "idle");
  await expect(page.locator('[data-city-stage][data-state="working"]')).toHaveCount(0);
  releaseResume();
  await expect(page.locator('[data-city-stage="sandbox"]')).toHaveAttribute("data-state", "done");
  await expect(page.locator(".lc-transport-mode")).toContainText(`${events.length} recorded events`);
  expect(resumedIds).toEqual(["0", String(split)]);
  await page.waitForTimeout(1400);
  expect(connections).toBe(2);
});

test("sample city works at narrow widths with reduced motion and no WebGL", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  let backendReads = 0;
  page.on("request", request => { if (request.url().includes("/api/backend/")) backendReads++; });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith("webgl")) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto("/playground/agent-city?demo=library");
  await expect(page.getByText("Sample replay", { exact: true }).first()).toBeVisible();
  for (const name of ["PM", "Architect", "Coder", "Reviewer", "Tester", "Sandbox"]) {
    const button = page.getByRole("button", { name: `Inspect ${name}`, exact: true });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }
  const position = page.getByRole("slider", { name: "Replay position", exact: true });
  await position.fill((await position.getAttribute("max"))!);
  await expect(page.locator('[data-city-stage="sandbox"]')).toHaveAttribute("data-state", "done");
  await expect(page.getByRole("region", { name: "Stage evidence", exact: true })).toBeVisible();
  const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, overflow: Array.from(document.querySelectorAll<HTMLElement>("body *")).flatMap(element => {
    const rect = element.getBoundingClientRect();
    return rect.right > window.innerWidth + 1 ? [{ tag: element.tagName, className: element.className, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) }] : [];
  }).slice(0, 20) }));
  expect(layout.width, JSON.stringify(layout.overflow)).toBeLessThanOrEqual(320);
  expect(backendReads).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("live-city-mobile-fallback.png"), fullPage: true });
});

test("sample replay reveals repaired source only after its recorded file rewrite", async ({ page }) => {
  const demo = getDemoRun("library");
  const repairStart = demo.events.findIndex(event => event.event === "agent.started" && event.agent === "coder" && event.iteration === 1);
  const rewrite = demo.events.findIndex((event, index) => index > repairStart && event.event === "file.written" && event.path === "main.py");
  expect(repairStart).toBeGreaterThan(0);
  expect(rewrite).toBeGreaterThan(repairStart);
  await page.goto("/playground/agent-city?demo=library");
  // The slider is server-rendered; its change handler is ready after the scene's effect runs.
  await expect(page.locator(".lc-world")).toHaveAttribute("data-status", /^(ready|fallback)$/);
  const scene = page.getByRole("region", { name: "Live agent city", exact: true });
  const position = page.getByRole("slider", { name: "Replay position", exact: true });
  await position.fill(String(repairStart + 1));
  await expect(position).toHaveValue(String(repairStart + 1));
  await expect(page.locator('[data-city-stage="coder"]')).toHaveAttribute("data-state", "working");
  await expect(scene).toHaveAttribute("data-animation-paused", "true");
  await page.getByRole("button", { name: "Inspect Coder", exact: true }).click();
  const evidence = page.getByRole("region", { name: "Stage evidence", exact: true });
  await evidence.getByRole("button", { name: "main.py", exact: true }).click();
  await expect(page.getByLabel("main.py source code", { exact: true })).toHaveText(demo.initialFiles["main.py"]);
  await expect(page.getByLabel("main.py source code", { exact: true })).not.toContainText("response_model");
  await position.fill(String(rewrite + 1));
  await evidence.getByRole("button", { name: "main.py", exact: true }).click();
  await expect(page.getByLabel("main.py source code", { exact: true })).toHaveText(demo.finalFiles["main.py"]);
  await expect(page.getByLabel("main.py source code", { exact: true })).toContainText("response_model=BookOut");
  await position.fill(String(repairStart + 1));
  await evidence.getByRole("button", { name: "main.py", exact: true }).click();
  await expect(page.getByLabel("main.py source code", { exact: true })).toHaveText(demo.initialFiles["main.py"]);
  await page.getByRole("button", { name: "Switch city to night", exact: true }).click();
  await expect(page.locator(".live-agent-city")).toHaveAttribute("data-night", "true");
  await expect(page.getByLabel("main.py source code", { exact: true })).toHaveText(demo.initialFiles["main.py"]);
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await expect(scene).toHaveAttribute("data-animation-paused", "false");
  await page.getByRole("button", { name: "Pause replay", exact: true }).click();
  await expect(scene).toHaveAttribute("data-animation-paused", "true");
});

test("city building selection, orbit, zoom, and lighting work while replay is paused", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/playground/agent-city?demo=library");
  await expect(page.locator(".lc-world")).toHaveAttribute("data-status", "ready");
  const canvas = page.locator(".lc-world canvas");
  await page.getByRole("button", { name: "Reset city camera", exact: true }).click();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Live city canvas is unavailable");
  // Project a building into the default isometric view, then use a real pointer click.
  const aspect = bounds.width / bounds.height;
  const halfHeight = Math.max(11.4, 14.3 / aspect);
  const camera = new OrthographicCamera(-halfHeight * aspect, halfHeight * aspect, halfHeight, -halfHeight, 0.1, 100);
  camera.position.set(21, 25.8, 28);
  camera.lookAt(0, 0.8, 0);
  camera.updateMatrixWorld();
  const reviewer = new Vector3(6.4, 1.8, 3.6).project(camera);
  await canvas.click({ position: { x: (reviewer.x + 1) * bounds.width / 2, y: (1 - reviewer.y) * bounds.height / 2 } });
  await expect(page.getByRole("button", { name: "Inspect Reviewer", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Follow active agent", exact: true })).toHaveAttribute("aria-pressed", "false");
  // Compare the rendered city, excluding toolbar hover and press transitions.
  const sceneImage = () => page.screenshot({ clip: { x: bounds.x + 70, y: bounds.y + 75, width: bounds.width - 140, height: bounds.height - 160 }, animations: "disabled" });
  const day = await sceneImage();
  await page.getByRole("button", { name: "Switch city to night", exact: true }).click();
  await expect(page.locator(".live-agent-city")).toHaveAttribute("data-night", "true");
  await expect.poll(async () => (await sceneImage()).equals(day)).toBe(false);
  await page.getByRole("button", { name: "Switch city to day", exact: true }).click();
  await page.getByRole("button", { name: "Reset city camera", exact: true }).click();
  const home = await sceneImage();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 110, bounds.y + bounds.height / 2 + 25, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await sceneImage()).equals(home)).toBe(false);
  await page.getByRole("button", { name: "Reset city camera", exact: true }).click();
  await expect.poll(async () => (await sceneImage()).equals(home)).toBe(true);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect.poll(async () => (await sceneImage()).equals(home)).toBe(false);
  await expect(page.getByRole("region", { name: "Live agent city", exact: true })).toHaveAttribute("data-animation-paused", "true");
});

for (const width of [1440, 320]) {
  test(`city shares CodeForge appearance and preserves replay when switching theme at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => { if (!localStorage.getItem("codeforge-theme")) localStorage.setItem("codeforge-theme", "light"); });
    await page.goto("/playground/agent-city?demo=library");
    await expect(page.locator(".lc-world")).toHaveAttribute("data-status", "ready");
    const position = page.getByRole("slider", { name: "Replay position", exact: true });
    await position.fill("24");
    await page.getByRole("button", { name: "Inspect Coder", exact: true }).click();
    const evidence = page.getByRole("region", { name: "Stage evidence", exact: true });
    await evidence.getByRole("button", { name: "main.py", exact: true }).click();
    const source = await page.getByLabel("main.py source code", { exact: true }).innerText();
    const appearance = () => page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const city = getComputedStyle(document.querySelector(".live-agent-city")!);
      const inspector = getComputedStyle(document.querySelector(".lc-inspector")!);
      return { inherited: ["--bg", "--surface", "--accent", "--fg"].every(token => city.getPropertyValue(token) === root.getPropertyValue(token)), background: city.backgroundColor, inspector: inspector.backgroundColor, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    const light = await appearance();
    expect(light.inherited).toBe(true);
    expect(light.overflow).toBe(false);
    const toggle = page.getByRole("button", { name: "Dark mode for agent dashboard", exact: true });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    const dark = await appearance();
    expect(dark.inherited).toBe(true);
    expect(dark.background).not.toBe(light.background);
    expect(dark.inspector).not.toBe(light.inspector);
    expect(dark.overflow).toBe(false);
    await expect(position).toHaveValue("24");
    await expect(page.getByLabel("main.py source code", { exact: true })).toHaveText(source);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect((await appearance()).background).toBe(light.background);
  });
}

test("playground theme follows CodeForge while the island quest keeps its progress", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => { if (!localStorage.getItem("codeforge-theme")) localStorage.setItem("codeforge-theme", "light"); });
  await page.goto("/playground/agent-city");
  await page.getByRole("button", { name: "Pick up an idea", exact: true }).click();
  const toggle = page.getByRole("button", { name: "Dark mode for agent dashboard", exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Visit PM", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Visit PM", exact: true })).toBeVisible();
});
