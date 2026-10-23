export function resolve(schema, document, depth = 0) {
  if (!schema || depth > 12) return {};
  if (schema.$ref) {
    if (!schema.$ref.startsWith("#/")) return {};
    const value = schema.$ref.slice(2).split("/").reduce((node, key) => node?.[key.replaceAll("~1", "/").replaceAll("~0", "~")], document);
    return resolve(value, document, depth + 1);
  }
  if (schema.allOf) {
    const parts = schema.allOf.map(part => resolve(part, document, depth + 1));
    return { ...schema, ...Object.assign({}, ...parts), properties: Object.assign({}, ...parts.map(part => part.properties || {})), required: [...new Set(parts.flatMap(part => part.required || []))] };
  }
  return schema;
}

export function fieldSchema(raw, document) {
  const schema = resolve(raw, document);
  const variants = schema.anyOf || schema.oneOf;
  return variants ? resolve(variants.find(item => item.type !== "null"), document) : schema;
}

function parameters(path, operation, document) {
  const merged = new Map();
  for (const raw of [...(path.parameters || []), ...(operation.parameters || [])]) {
    const item = resolve(raw, document);
    merged.set(`${item.in}:${item.name}`, { ...item, schema: fieldSchema(item.schema, document) });
  }
  return [...merged.values()];
}

function bodySchema(operation, document) {
  const body = resolve(operation?.requestBody, document);
  return resolve(body.content?.["application/json"]?.schema, document);
}

function listKey(schema, document) {
  schema = resolve(schema, document);
  if (schema.type === "array") return "";
  return ["items", "results", "data"].find(key => resolve(schema.properties?.[key], document).type === "array");
}

export function discover(document) {
  const collections = [];
  for (const [path, raw] of Object.entries(document.paths || {})) {
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("{") || /[?#]/.test(path)) continue;
    const routes = resolve(raw, document);
    if (!routes.get) continue;
    const response = Object.entries(routes.get.responses || {}).find(([code]) => /^2\d\d$/.test(code))?.[1];
    const schema = resolve(response, document).content?.["application/json"]?.schema;
    const key = listKey(schema, document);
    if (key === undefined) continue;
    const base = path.replace(/\/$/, "");
    const matches = Object.entries(document.paths || {}).filter(([candidate]) => candidate.startsWith(`${base}/`) && /^\{[^{}\/]+\}\/?$/.test(candidate.slice(base.length + 1)));
    const detail = matches.length === 1 ? matches[0] : undefined;
    const detailRoutes = resolve(detail?.[1], document);
    const editMethod = detailRoutes.patch ? "patch" : "put";
    function supported(operation, item) {
      return operation && !parameters(item, operation, document).some(param => param.required && !["path", "query"].includes(param.in) || param.required && param.in === "query" && param.schema.default === undefined);
    }
    const create = supported(routes.post, routes) && bodySchema(routes.post, document).properties ? routes.post : null;
    const edit = supported(detailRoutes[editMethod], detailRoutes) && bodySchema(detailRoutes[editMethod], document).properties ? detailRoutes[editMethod] : null;
    collections.push({
      path, key, name: base.split("/").pop().replaceAll(/[-_]/g, " "),
      parameters: parameters(routes, routes.get, document),
      create, createSchema: create ? bodySchema(create, document) : null,
      detailPath: detail?.[0], idParameter: detail?.[0].match(/\{([^}]+)\}/)?.[1],
      detailGet: supported(detailRoutes.get, detailRoutes) ? detailRoutes.get : null,
      edit, editMethod: editMethod.toUpperCase(), editSchema: edit ? bodySchema(edit, document) : null,
      remove: supported(detailRoutes.delete, detailRoutes) ? detailRoutes.delete : null,
    });
  }
  return collections;
}

export function recordId(row, collection) {
  if (!row || typeof row !== "object") return undefined;
  const value = row[collection.idParameter] ?? row.id ?? row._id;
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

export function detailPath(collection, row) {
  const id = recordId(row, collection);
  if (id === undefined) throw new Error("This record has no usable identifier.");
  return collection.detailPath.replace(`{${collection.idParameter}}`, encodeURIComponent(String(id)));
}

export function parseValue(value, raw, document) {
  const resolved = resolve(raw, document);
  if (value === null && (resolved.anyOf || resolved.oneOf || []).some(item => item.type === "null")) return null;
  const schema = fieldSchema(raw, document);
  if (schema.enum) {
    const selected = schema.enum.find(item => String(item) === String(value));
    if (selected === undefined) throw new Error("Choose a value from the list.");
    return selected;
  }
  if (["integer", "number"].includes(schema.type)) {
    if (!String(value).trim() || !Number.isFinite(Number(value)) || schema.type === "integer" && !Number.isInteger(Number(value))) throw new Error("Enter a valid number.");
    const number = Number(value);
    if (schema.minimum !== undefined && number < schema.minimum || schema.maximum !== undefined && number > schema.maximum) throw new Error("Number is outside the allowed range.");
    return number;
  }
  if (schema.type === "boolean") return value === true || value === "true";
  if (["array", "object"].includes(schema.type)) {
    const parsed = JSON.parse(value);
    if (schema.type === "array" ? !Array.isArray(parsed) : !parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`Enter a JSON ${schema.type}.`);
    return parsed;
  }
  return value;
}

export function formBody(values, included, schema, document) {
  const output = {};
  for (const [name, raw] of Object.entries(schema.properties || {})) {
    if (raw.readOnly || !included.includes(name)) continue;
    try { output[name] = parseValue(values[name] === undefined ? "" : values[name], raw, document); }
    catch (error) { throw new Error(`${name}: ${error.message}`); }
  }
  return output;
}
