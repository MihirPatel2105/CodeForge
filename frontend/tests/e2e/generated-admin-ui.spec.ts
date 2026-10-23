import { expect, test } from "@playwright/test";

const adminUrl = process.env.ADMIN_UI_TEST_URL;
test.skip(!adminUrl, "Build and serve the admin-ui template, then set ADMIN_UI_TEST_URL.");

const json = (schema: unknown) => ({ content: { "application/json": { schema } } });
const bookSchema = { type: "object", required: ["title", "copies"], properties: { title: { type: "string", minLength: 1 }, copies: { type: "integer", minimum: 0 }, available: { type: "boolean", default: false } } };
const schema = { info: { title: "Library API" }, paths: {
  "/books": { get: { responses: { "200": json({ type: "array", items: bookSchema }) } }, post: { requestBody: json(bookSchema) } },
  "/books/{book_id}": { get: {}, patch: { requestBody: json(bookSchema) }, delete: {} },
} };

test("collection manager creates, searches, edits and confirms deletion", async ({ page }) => {
  let rows = [{ id: "1", title: "Computer networks", copies: 2, available: false }];
  const mutations: { method: string; body: Record<string, unknown> | null }[] = [];
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/openapi.json") return route.fulfill({ json: schema });
    if (request.method() === "GET") return route.fulfill({ json: path === "/api/books" ? rows : rows[0] });
    const body = request.postData() ? request.postDataJSON() : null;
    mutations.push({ method: request.method(), body });
    if (request.method() === "POST") rows.push({ id: "2", ...body });
    if (request.method() === "PATCH") rows[0] = { ...rows[0], ...body };
    if (request.method() === "DELETE") { rows = rows.filter(row => row.id !== path.split("/").pop()); return route.fulfill({ status: 204 }); }
    return route.fulfill({ status: request.method() === "POST" ? 201 : 200, json: rows.at(-1) });
  });
  await page.goto(adminUrl!);
  await expect(page.getByRole("cell", { name: "Computer networks", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add record", exact: true }).click();
  await page.getByLabel("title *", { exact: true }).fill("Operating systems");
  await page.getByLabel("copies *", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Record saved.");
  expect(mutations[0]).toEqual({ method: "POST", body: { title: "Operating systems", copies: 3, available: false } });
  await page.getByRole("searchbox").fill("Operating");
  await expect(page.getByRole("cell", { name: "Computer networks", exact: true })).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "Operating systems", exact: true })).toBeVisible();
  await page.getByRole("searchbox").fill("");
  await page.getByRole("row").filter({ hasText: "Computer networks" }).getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("title *", { exact: true })).toHaveValue("Computer networks");
  await page.getByLabel("title *", { exact: true }).fill("Advanced networks");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Advanced networks", exact: true })).toBeVisible();
  await page.getByRole("row").filter({ hasText: "Advanced networks" }).getByRole("button", { name: "Delete", exact: true }).click();
  expect(mutations.filter(item => item.method === "DELETE")).toHaveLength(0);
  await page.getByRole("button", { name: "Keep record" }).click();
  await page.getByRole("row").filter({ hasText: "Advanced networks" }).getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByRole("status")).toHaveText("Record deleted.");
  await expect(page.getByRole("cell", { name: "Advanced networks", exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("failed saves retain entered fields and display API validation errors", async ({ page }) => {
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/openapi.json") return route.fulfill({ json: schema });
    if (route.request().method() === "POST") return route.fulfill({ status: 422, json: { detail: [{ loc: ["body", "title"], msg: "Title already exists" }] } });
    return route.fulfill({ json: [] });
  });
  await page.goto(adminUrl!);
  await page.getByRole("button", { name: "Add record", exact: true }).click();
  await page.getByLabel("title *", { exact: true }).fill("Existing title");
  await page.getByLabel("copies *", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Title already exists" })).toBeVisible();
  await expect(page.getByLabel("title *", { exact: true })).toHaveValue("Existing title");
});

test("schema connection failures offer retry and recover", async ({ page }) => {
  let fail = true;
  await page.route("**/api/**", route => {
    if (fail) return route.fulfill({ status: 503, json: { detail: "API is starting" } });
    return route.fulfill({ json: new URL(route.request().url()).pathname === "/api/openapi.json" ? schema : [] });
  });
  await page.goto(adminUrl!);
  await expect(page.getByRole("alert").filter({ hasText: "API is starting" })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Retry connection" }).click();
  await expect(page.getByRole("heading", { name: "books", exact: true })).toBeVisible();
});

test("required query filters and offset pagination use the declared API parameters", async ({ page }) => {
  const filteredSchema = structuredClone(schema);
  Object.assign(filteredSchema.paths["/books"].get, { parameters: [
    { name: "category", in: "query", required: true, schema: { type: "string" } },
    { name: "skip", in: "query", schema: { type: "integer", default: 0 } },
    { name: "limit", in: "query", schema: { type: "integer", maximum: 2 } },
  ] });
  const listQueries: URLSearchParams[] = [];
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/openapi.json") return route.fulfill({ json: filteredSchema });
    listQueries.push(url.searchParams);
    const offset = Number(url.searchParams.get("skip"));
    return route.fulfill({ json: [
      { id: "1", title: "Networks", copies: 1 },
      { id: "2", title: "Databases", copies: 2 },
      { id: "3", title: "Algorithms", copies: 3 },
    ].slice(offset, offset + 2) });
  });
  await page.goto(adminUrl!);
  await expect(page.getByRole("alert").filter({ hasText: "Enter category" })).toBeVisible();
  expect(listQueries).toHaveLength(0);
  await page.getByLabel("category *", { exact: true }).fill("Computing");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("cell", { name: "Networks", exact: true })).toBeVisible();
  expect(listQueries[0].get("category")).toBe("Computing");
  expect(listQueries[0].get("limit")).toBe("2");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Algorithms", exact: true })).toBeVisible();
  expect(listQueries[1].get("skip")).toBe("2");
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Networks", exact: true })).toBeVisible();
});

test("local containers manage a record through the real proxy", async ({ page }) => {
  test.skip(process.env.ADMIN_UI_LIVE_TEST !== "1", "Requires an isolated disposable book API.");
  await page.goto(adminUrl!);
  await expect(page.getByRole("heading", { name: "books", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add record", exact: true }).click();
  const title = `Browser test ${Date.now()}`;
  await page.getByLabel("title *", { exact: true }).fill(title);
  await page.getByLabel("copies *", { exact: true }).fill("4");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: title });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("copies", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(row.getByRole("cell", { name: "7", exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(row).toHaveCount(0);
  const schemaResponse = await page.request.get(`${adminUrl}/openapi.json`);
  expect(schemaResponse.ok()).toBe(true);
  expect((await schemaResponse.json()).info.title).toBe("Book collection");
  if (process.env.ADMIN_UI_SCREENSHOT) await page.screenshot({ path: process.env.ADMIN_UI_SCREENSHOT, fullPage: true });
});
