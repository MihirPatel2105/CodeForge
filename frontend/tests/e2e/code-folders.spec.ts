import { expect, test } from "@playwright/test";

test("code folders support keyboard expansion and distinguish files with the same name", async ({ page }) => {
  const id = "folders-run", at = "2026-10-14T08:00:00Z";
  const files = [
    { path: "app/main.py", content: "app_value = 1\n" },
    { path: "tests/main.py", content: "test_value = 2\n" },
    { path: "README.md", content: "Project notes\n" },
  ];
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "preview", first_name: "Preview", is_admin: false } }));
  await page.route(`**/api/backend/runs/${id}`, route => route.fulfill({ json: {
    id, project_id: "p", prompt: "Build an items API", status: "succeeded", state: { files, loop_count: 0, review: { findings: [{ severity: "blocking", file: "app/main.py", line: 1, issue: "Check the app value" }] } }, created_at: at, updated_at: at,
  } }));
  await page.route(`**/api/backend/runs/${id}/files`, route => route.fulfill({ json: { run_id: id, files } }));
  await page.route(`**/api/backend/runs/${id}/file-history`, route => route.fulfill({ json: { run_id: id, versions: [] } }));
  const events = [
    { event: "run.started", run_id: id, prompt: "Build an items API", at },
    ...files.map(file => ({ event: "file.written", path: file.path, bytes: file.content.length, at })),
    { event: "run.completed", status: "succeeded", iterations: 0, at },
  ];
  await page.route(`**/api/backend/runs/${id}/stream`, route => route.fulfill({ contentType: "text/event-stream", body: events.map((event, index) => `id: ${index + 1}\ndata: ${JSON.stringify(event)}\n\n`).join("") }));
  await page.goto(`/runs/${id}`);
  const code = page.getByRole("region", { name: "Generated code", exact: true });
  const folder = code.getByRole("button", { name: "Folder app", exact: true });
  await expect(folder).toHaveAttribute("aria-expanded", "true");
  await folder.focus();
  await page.keyboard.press("Space");
  await expect(folder).toHaveAttribute("aria-expanded", "false");
  await expect(code.getByRole("button", { name: "app/main.py new", exact: true })).toHaveCount(0);
  await page.keyboard.press("Space");
  await code.getByRole("button", { name: "app/main.py new", exact: true }).click();
  await expect(code).toContainText("app_value = 1");
  await code.getByRole("button", { name: "tests/main.py new", exact: true }).click();
  await expect(code).toContainText("test_value = 2");
  for (let attempt = 0; attempt < 2; attempt++) {
    await folder.click();
    await expect(folder).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("tab", { name: /Problems/ }).click();
    await page.getByRole("button", { name: "View app/main.py line 1", exact: true }).click();
    await expect(folder).toHaveAttribute("aria-expanded", "true");
    await expect(code).toContainText("app_value = 1");
  }
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await code.getByRole("button", { name: "tests/main.py new", exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Copy code", exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("test_value = 2\n");
  await code.getByRole("button", { name: "Actions for app/main.py", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download file", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("main.py");
  await page.keyboard.press("Escape");
  const resize = page.getByRole("separator", { name: "Resize file sidebar", exact: true });
  const before = await resize.getAttribute("aria-valuenow");
  await resize.focus(); await page.keyboard.press("ArrowRight");
  await expect(resize).not.toHaveAttribute("aria-valuenow", before!);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
