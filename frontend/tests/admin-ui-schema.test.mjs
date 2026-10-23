import assert from "node:assert/strict";
import test from "node:test";
import { detailPath, discover, formBody, parseValue, resolve } from "../../backend/app/templates/admin_ui/lib/schema.mjs";

const json = schema => ({ content: { "application/json": { schema } } });
const body = { type: "object", required: ["title"], properties: { title: { type: "string" }, copies: { type: "integer" }, available: { type: "boolean" }, tags: { type: "array" }, metadata: { type: "object" }, note: { anyOf: [{ type: "string" }, { type: "null" }] } } };
function document() {
  return { components: { schemas: { Book: body } }, paths: {
    "/health": { get: { responses: { "200": json({ type: "object" }) } } },
    "/books": { get: { responses: { "200": json({ type: "array", items: { $ref: "#/components/schemas/Book" } }) } }, post: { requestBody: json({ $ref: "#/components/schemas/Book" }) } },
    "/books/{book_id}": { get: {}, patch: { requestBody: json(body) }, delete: {} },
  } };
}

test("discovers collections and matches CRUD routes without exposing health as a collection", () => {
  const result = discover(document());
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "books");
  assert.equal(result[0].createSchema.properties.title.type, "string");
  assert.equal(result[0].editMethod, "PATCH");
  assert.equal(detailPath(result[0], { id: "a/b ?" }), "/books/a%2Fb%20%3F");
  assert.throws(() => detailPath(result[0], {}), /identifier/);
  assert.equal(detailPath(result[0], { book_id: 0 }), "/books/0");
});

test("understands wrapped list responses and inherited parameters with operation overrides", () => {
  const doc = document();
  doc.paths["/books"].get.responses["200"] = json({ type: "object", properties: { items: { type: "array", items: {} } } });
  doc.paths["/books"].parameters = [{ name: "limit", in: "query", schema: { type: "integer", default: 20 } }];
  doc.paths["/books"].get.parameters = [{ name: "limit", in: "query", schema: { type: "integer", maximum: 10 } }];
  const [collection] = discover(doc);
  assert.equal(collection.key, "items");
  assert.equal(collection.parameters.length, 1);
  assert.equal(collection.parameters[0].schema.maximum, 10);
});

test("omits unsupported mutations with required query filters and ambiguous detail paths", () => {
  const doc = document();
  doc.paths["/books"].post.parameters = [{ name: "owner", in: "query", required: true, schema: { type: "string" } }];
  assert.equal(discover(doc)[0].create, null);
  doc.paths["/books/{other}"] = { delete: {} };
  assert.equal(discover(doc)[0].remove, null);
});

test("serializes numeric, boolean, nested and nullable fields, omitting excluded fields", () => {
  const values = { title: "Library", copies: "2", available: "false", tags: '["cs"]', metadata: '{"shelf":3}', note: null };
  assert.deepEqual(formBody(values, Object.keys(values), body, document()), { title: "Library", copies: 2, available: false, tags: ["cs"], metadata: { shelf: 3 }, note: null });
  assert.deepEqual(formBody(values, ["title"], body, document()), { title: "Library" });
  assert.throws(() => parseValue("", { type: "integer" }, {}), /number/);
  assert.throws(() => parseValue("2.5", { type: "integer" }, {}), /number/);
  assert.throws(() => parseValue("[]", { type: "object" }, {}), /object/);
  assert.throws(() => parseValue("12", { type: "integer", maximum: 10 }, {}), /range/);
});

test("bounds recursive references and merges allOf fields", () => {
  assert.deepEqual(resolve({ $ref: "#/cycle" }, { cycle: { $ref: "#/cycle" } }), {});
  const merged = resolve({ allOf: [{ properties: { title: { type: "string" } }, required: ["title"] }, { properties: { copies: { type: "integer" } } }] }, {});
  assert.deepEqual(Object.keys(merged.properties), ["title", "copies"]);
  assert.deepEqual(merged.required, ["title"]);
});
