import type { JsonSchema, PreviewOperation, PreviewParameter } from "@/lib/types";

export function parameterSchema(schema: JsonSchema): JsonSchema {
  const variants = schema.anyOf?.filter(item => item.type !== "null");
  return variants?.length === 1 ? { ...schema, ...variants[0] } : schema;
}

export function parameterDefault(parameter: PreviewParameter): string {
  const value = parameterSchema(parameter.schema).default;
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
}

function valueError(parameter: PreviewParameter, value: string): string | null {
  const schema = parameterSchema(parameter.schema);
  const name = parameter.name;
  if (schema.type === "integer" && !/^[+-]?\d+$/.test(value)) return `${name} must be an integer.`;
  if ((schema.type === "integer" || schema.type === "number") && (!value.trim() || !Number.isFinite(Number(value)) || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value))) return `${name} must be a number.`;
  if (schema.type === "boolean" && value !== "true" && value !== "false") return `${name} must be true or false.`;
  if (schema.type && !["string", "integer", "number", "boolean"].includes(schema.type)) return null;
  const typedValue = schema.type === "integer" || schema.type === "number" ? Number(value) : schema.type === "boolean" ? value === "true" : value;
  if (schema.enum && !schema.enum.some(item => item === typedValue)) return `${name} must use an allowed value.`;
  if (schema.type === "integer" || schema.type === "number") {
    if (schema.minimum !== undefined && Number(value) < schema.minimum) return `${name} must be at least ${schema.minimum}.`;
    if (schema.maximum !== undefined && Number(value) > schema.maximum) return `${name} must be at most ${schema.maximum}.`;
  }
  if (schema.type === "string") {
    if (schema.minLength !== undefined && Array.from(value).length < schema.minLength) return `${name} must contain at least ${schema.minLength} characters.`;
    if (schema.maxLength !== undefined && Array.from(value).length > schema.maxLength) return `${name} must contain at most ${schema.maxLength} characters.`;
  }
  return null;
}

export function parameterErrors(operation: PreviewOperation | undefined, resolvedPath: string): string[] {
  if (!operation?.parameters?.length) return [];
  const separator = resolvedPath.indexOf("?");
  const base = separator < 0 ? resolvedPath : resolvedPath.slice(0, separator);
  const query = new URLSearchParams(separator < 0 ? "" : resolvedPath.slice(separator + 1));
  const template = operation.path.split("/");
  const segments = base.split("/");
  const errors: string[] = [];
  for (const parameter of operation.parameters) {
    let values: string[];
    if (parameter.location === "query") values = query.getAll(parameter.name);
    else {
      const index = template.indexOf(`{${parameter.name}}`);
      if (index < 0) continue;
      const raw = segments[index];
      if (!raw || raw.includes("{")) values = [];
      else {
        try { values = [decodeURIComponent(raw)]; }
        catch { errors.push(`${parameter.name} contains invalid URL encoding.`); continue; }
      }
    }
    if (!values.length && parameter.required) errors.push(`${parameter.name} is required.`);
    for (const value of values) {
      const error = valueError(parameter, value);
      if (error) { errors.push(error); break; }
    }
  }
  return errors;
}
