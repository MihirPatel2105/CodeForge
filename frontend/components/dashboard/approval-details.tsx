import { AnimatedDisclosure } from "./animated-disclosure";

type Field = { name: string; type: string; required?: boolean; default?: unknown; description?: string };
type Details = { summary?: string; entities?: { name: string; fields: Field[] }[]; user_stories?: string[]; out_of_scope?: string[]; endpoints?: { method: string; path: string; request_model?: string; response_model?: string; status_code?: number; description?: string }[]; notes?: string[] };
export function ApprovalDetails({ details }: { details: unknown }) {
  if (!details || typeof details !== "object") return null;
  const value = details as Details;
  return <div className="space-y-4 px-5 pb-4 text-sm sm:px-6">
    {value.summary && <p className="leading-6 text-fg-muted">{value.summary}</p>}
    {value.entities?.map(entity => <div key={entity.name} className="overflow-hidden rounded-xl border border-border"><h3 className="bg-surface-2 px-3 py-2 font-semibold">{entity.name}</h3><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-border"><th className="p-3">Field</th><th className="p-3">Type</th><th className="p-3">Rules</th></tr></thead><tbody>{entity.fields.map(field => <tr key={field.name} className="border-b border-border last:border-0"><td className="p-3 font-mono">{field.name}</td><td className="p-3">{field.type}</td><td className="p-3">{field.required ? "Required" : "Optional"}{field.default != null ? ` · Default: ${JSON.stringify(field.default)}` : ""}{field.description ? ` · ${field.description}` : ""}</td></tr>)}</tbody></table></div></div>)}
    {value.endpoints && <ul className="divide-y divide-border rounded-xl border border-border">{value.endpoints.map(endpoint => <li key={`${endpoint.method}:${endpoint.path}`} className="p-3"><p className="break-all font-mono font-semibold">{endpoint.method} {endpoint.path}</p><p className="mt-1 text-fg-muted">{endpoint.request_model ? `Request: ${endpoint.request_model} · ` : ""}Response: {endpoint.response_model || "No body"}{endpoint.status_code ? ` · HTTP ${endpoint.status_code}` : ""}</p>{endpoint.description && <p>{endpoint.description}</p>}</li>)}</ul>}
    {!!value.out_of_scope?.length && <div className="rounded-xl bg-warn-soft p-3"><p className="font-semibold">Outside this API’s scope</p><ul className="mt-1 list-disc pl-5">{value.out_of_scope.map(item => <li key={item}>{item}</li>)}</ul></div>}
    {!!(value.notes?.length || value.user_stories?.length) && <AnimatedDisclosure title="Requirements and design notes"><ul className="list-disc space-y-1 pl-5">{[...(value.user_stories ?? []), ...(value.notes ?? [])].map((item, i) => <li key={i}>{item}</li>)}</ul></AnimatedDisclosure>}
  </div>;
}
