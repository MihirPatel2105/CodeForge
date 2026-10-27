import { expect, test } from "@playwright/test";

for (const width of [320, 1440]) {
  test(`code slots support paste, replacement, deletion and retry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => sessionStorage.setItem("codeforge_password_mfa", JSON.stringify({
      ticket: "slots-ticket", email: "user@example.com", methods: ["totp"], startedAt: Date.now(),
    })));
    await page.route("**/api/backend/auth/me", route => route.fulfill({ status: 401, json: {} }));
    const submissions: unknown[] = [];
    await page.route("**/auth/login/complete", route => {
      submissions.push(route.request().postDataJSON());
      return route.fulfill({ status: 401, json: { error: { code: "invalid_totp", message: "That code was not accepted." } } });
    });
    await page.goto("/login/verify");
    const input = page.getByLabel("Authenticator code", { exact: true });
    const filled = page.locator(".cf-verification-code [data-filled]");
    const submit = page.getByRole("button", { name: "Verify and sign in", exact: true });
    await input.pressSequentially("12");
    await expect(filled).toHaveCount(2);
    await expect(submit).toBeDisabled();
    await input.press("End");
    await input.evaluate(node => {
      const data = new DataTransfer(); data.setData("text/plain", "654 321");
      node.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await expect(filled).toHaveCount(6);
    await expect(submit).toBeEnabled();
    expect(submissions).toHaveLength(0);
    await input.press("ControlOrMeta+a");
    await input.press("Backspace");
    await expect(filled).toHaveCount(0);
    await input.fill("123456");
    await submit.click();
    await expect.poll(() => submissions).toEqual([{ ticket: "slots-ticket", totp_code: "123456" }]);
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(filled).toHaveCount(0);
    await input.pressSequentially("987654");
    await expect(submit).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `/tmp/codeforge-code-slots-${width}.png` });
  });
}

test("agent activity uses real status, elapsed time and completion collapse", async ({ page }) => {
  const at = new Date(Date.now() - 2400).toISOString();
  let release!: () => void;
  const completed = new Promise<void>(resolve => { release = resolve; });
  let reads = 0;
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "micro-user", first_name: "Preview", is_admin: false } }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
  await page.route("**/api/backend/runs/micro-run", route => route.fulfill({ json: { id: "micro-run", project_id: "p", prompt: "Build an items API", status: "running", state: {}, metrics: null, created_at: at, updated_at: at } }));
  await page.route("**/api/backend/runs/micro-run/files", route => route.fulfill({ json: { files: [] } }));
  await page.route("**/api/backend/runs/micro-run/file-history", route => route.fulfill({ json: { versions: [] } }));
  await page.route("**/api/backend/runs/micro-run/stream", async route => {
    reads++;
    if (reads > 1) await completed;
    const events = reads === 1 ? [
      { event: "run.started", run_id: "micro-run", prompt: "Build an items API", at },
      { event: "agent.started", agent: "coder", iteration: 0, at },
      { event: "agent.message", agent: "coder", text: "Writing application files", at },
    ] : reads === 2 ? [{ event: "agent.completed", agent: "coder", output_summary: { files: 3 }, duration_ms: 4800, at }] : [];
    await route.fulfill({ contentType: "text/event-stream", body: events.map((event, index) => `id: ${(reads === 1 ? 0 : 3) + index + 1}\ndata: ${JSON.stringify(event)}\n\n`).join("") });
  });
  await page.goto("/runs/micro-run");
  const coder = page.getByRole("button", { name: "Inspect Coder, working", exact: true });
  await expect(coder.locator(".cf-agent-status-mark")).toHaveAttribute("data-status", "running");
  await coder.click();
  const thought = page.locator(".cf-stage-thought");
  await expect(thought.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  await expect(thought).toContainText("Writing application files");
  await expect(page.locator(".cf-stage-lattice")).toHaveAttribute("data-status", "working");
  await page.screenshot({ path: "/tmp/codeforge-agent-micro-working.png" });
  release();
  await expect(page.locator('[data-stage="coder"] .cf-agent-status-mark')).toHaveAttribute("data-status", "done");
  await expect(thought.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  await thought.getByRole("button").click();
  await expect(thought.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  await expect(thought.locator("[data-done]")).not.toHaveCount(0);
  await expect(page.locator(".cf-stage-lattice")).toHaveCount(0);
});

test("response segment preserves button semantics and keyboard selection", async ({ page }) => {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "micro-user", first_name: "Preview", is_admin: false } }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
  await page.route("**/api/backend/runs/micro-run/preview", route => route.fulfill({ json: { operations: [{ method: "GET", path: "/items", has_body: false }] } }));
  await page.route("**/api/backend/runs/micro-run/preview/request", route => route.fulfill({ json: { status: 200, content_type: "application/json", body: '{"items":[]}', duration_ms: 12, response_headers: { "content-type": "application/json" } } }));
  await page.goto("/runs/micro-run/try");
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  const control = page.getByRole("group", { name: "Response view", exact: true });
  await expect(control.getByRole("button", { name: "Pretty", exact: true })).toHaveAttribute("aria-pressed", "true");
  await control.getByRole("button", { name: "Pretty", exact: true }).focus();
  await page.keyboard.press("End");
  await expect(control.getByRole("button", { name: "Headers", exact: true })).toBeFocused();
  await expect(control.getByRole("button", { name: "Headers", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.keyboard.press("Home");
  await expect(control.getByRole("button", { name: "Pretty", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: "/tmp/codeforge-rubber-segment.png" });
});

test("demo activity clock follows playback and stops when paused", async ({ page }) => {
  await page.goto("/demo/library");
  await page.getByRole("button", { name: "Show stage details", exact: true }).click();
  const clock = page.locator(".cf-stage-lattice > span.font-mono");
  await expect(clock).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const pausedTime = await clock.textContent();
  const runClock = page.getByLabel("Run elapsed time", { exact: true });
  const pausedRunTime = await runClock.textContent();
  expect(pausedTime).not.toContain("m ");
  await page.waitForTimeout(1200);
  await expect(clock).toHaveText(pausedTime!);
  await expect(runClock).toHaveText(pausedRunTime!);
});
