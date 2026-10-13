import type { PreviewParameter } from "@/lib/types";
import { parameterSchema } from "@/lib/preview-parameters";

export function ParameterGuidance({ parameters }: { parameters: PreviewParameter[] }) {
  if (!parameters.length) return null;
  return <section aria-label="Supported parameters" className="space-y-3 rounded-lg border border-border bg-bg p-3">
    <p className="text-[12px] font-[700] text-fg">Supported parameters</p>
    <ul className="space-y-3">
      {parameters.map(parameter => {
        const schema = parameterSchema(parameter.schema);
        return <li key={`${parameter.location}:${parameter.name}`} className="min-w-0 break-words text-xs text-fg-muted">
          <p><span className="font-mono font-semibold text-fg">{parameter.name}</span> · {parameter.location} · {schema.type ?? "value"}{schema.format ? ` (${schema.format})` : ""} · {parameter.required ? "Required" : "Optional"}</p>
          {parameter.description && <p className="mt-1">{parameter.description}</p>}
          {schema.enum && <p className="mt-1">Allowed: {schema.enum.map(String).join(", ")}</p>}
          {schema.default !== undefined && <p className="mt-1">Default: {JSON.stringify(schema.default)}</p>}
          {(schema.minimum !== undefined || schema.maximum !== undefined) && <p className="mt-1">{schema.minimum !== undefined ? `Minimum: ${schema.minimum}` : ""}{schema.minimum !== undefined && schema.maximum !== undefined ? " · " : ""}{schema.maximum !== undefined ? `Maximum: ${schema.maximum}` : ""}</p>}
        </li>;
      })}
    </ul>
    <p className="text-xs text-fg-muted">Enable optional query parameters to include them. The API checks additional schema rules when sent.</p>
  </section>;
}
