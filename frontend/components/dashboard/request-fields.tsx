"use client";
import { Notice } from "@/components/ui/notice";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import type { JsonSchema } from "@/lib/types";

export function RequestFields({ schema, body, onChange, onValidity }: { schema: JsonSchema; body: string; onChange: (body: string) => void; onValidity: (valid: boolean) => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    try { return Object.fromEntries(Object.entries(JSON.parse(body)).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)])); } catch { return {}; }
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [omitted, setOmitted] = useState<string[]>(() => { try { const parsed = JSON.parse(body); return Object.keys(schema.properties ?? {}).filter(name => !(name in parsed)); } catch { return []; } });
  function update(next: Record<string, string>, excluded = omitted) {
    setValues(next); setOmitted(excluded);
    const output: Record<string, unknown> = {};
    const issues: Record<string, string> = {};
    for (const [name, raw] of Object.entries(schema.properties ?? {})) {
      if (excluded.includes(name)) continue;
      const field = raw.anyOf?.find(item => item.type !== "null") ?? raw;
      const value = next[name] ?? "";
      try {
        if (value === "null" && raw.anyOf?.some(item => item.type === "null")) output[name] = null;
        else if (field.type === "integer" || field.type === "number") {
          if (!value.trim() || !Number.isFinite(Number(value)) || (field.type === "integer" && !Number.isInteger(Number(value)))) throw new Error("Enter a valid number.");
          output[name] = Number(value);
        } else if (["array", "object", "boolean"].includes(field.type ?? "")) {
          output[name] = JSON.parse(value);
          if (field.type === "array" && !Array.isArray(output[name])) throw new Error("Enter a JSON array.");
          if (field.type === "object" && (!output[name] || typeof output[name] !== "object" || Array.isArray(output[name]))) throw new Error("Enter a JSON object.");
          if (field.type === "boolean" && typeof output[name] !== "boolean") throw new Error("Choose true or false.");
        } else output[name] = value;
      } catch { issues[name] = `Enter a valid ${field.type || "value"}.`; }
    }
    setErrors(issues); onValidity(Object.keys(issues).length === 0);
    if (!Object.keys(issues).length) onChange(JSON.stringify(output, null, 2));
  }
  return <div className="space-y-3">{Object.entries(schema.properties ?? {}).map(([name, raw]) => {
    const field = raw.anyOf?.find(item => item.type !== "null") ?? raw;
    const required = schema.required?.includes(name);
    const inputId = `field-${name}`;
    return <div key={name}><div className="flex items-center justify-between gap-3"><label htmlFor={inputId} className="text-sm font-semibold">{name} <span className="font-normal text-fg-muted">{required ? "Required" : "Optional"}</span></label>{!required && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!omitted.includes(name)} onChange={event => update(values, event.target.checked ? omitted.filter(key => key !== name) : [...omitted, name])} />Include</label>}</div>
      {field.type === "boolean" ? <select id={inputId} disabled={omitted.includes(name)} value={values[name] ?? "false"} onChange={event => update({ ...values, [name]: event.target.value })} className="cf-project-select mt-1 h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm"><option value="false">false</option><option value="true">true</option></select> : <Input id={inputId} disabled={omitted.includes(name)} value={values[name] ?? ""} inputMode={field.type === "integer" || field.type === "number" ? "decimal" : "text"} onChange={event => update({ ...values, [name]: event.target.value })} aria-invalid={Boolean(errors[name])} placeholder={field.type === "array" ? '["example"]' : field.format || field.type} className="mt-1" />}
      {field.description && <p className="mt-1 text-xs text-fg-muted">{field.description}</p>}{errors[name] && <Notice compact className="mt-1">{errors[name]}</Notice>}
    </div>;
  })}</div>;
}
