"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnimatedCheckbox } from "@/components/ui/animated-checkbox";
import { motion } from "motion/react";
import { useMotionPreference } from "@/lib/use-motion-preference";

export type QueryParameter = { key: string; name: string; value: string; enabled: boolean };

export function requestPath(path: string, parameters: QueryParameter[]) {
  const active = parameters.filter(parameter => parameter.enabled && parameter.name.trim());
  if (!active.length) return path.trim();
  const trimmed = path.trim();
  const separator = trimmed.indexOf("?");
  const base = separator < 0 ? trimmed : trimmed.slice(0, separator);
  const query = separator < 0 ? "" : trimmed.slice(separator + 1);
  const values = new URLSearchParams(query);
  for (const parameter of active) values.append(parameter.name.trim(), parameter.value);
  return `${base}?${values}`;
}

export function splitRequestPath(path: string): { path: string; parameters: QueryParameter[] } {
  const separator = path.indexOf("?");
  const base = separator < 0 ? path : path.slice(0, separator);
  const query = separator < 0 ? "" : path.slice(separator + 1);
  return {
    path: base,
    parameters: Array.from(new URLSearchParams(query), ([name, value]) => ({
      key: crypto.randomUUID(), name, value, enabled: true,
    })),
  };
}

export function RequestQuery({ parameters, onChange, disabled }: {
  parameters: QueryParameter[];
  onChange: (parameters: QueryParameter[]) => void;
  disabled: boolean;
}) {
  const reduced = useMotionPreference();
  function update(key: string, patch: Partial<QueryParameter>) {
    onChange(parameters.map(parameter => parameter.key === key ? { ...parameter, ...patch } : parameter));
  }

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <legend className="text-[12px] font-[700] text-fg">Query parameters</legend>
      <div className="space-y-3">
      {parameters.map((parameter, index) => (
        <motion.div key={parameter.key} layout={reduced ? false : "position"}
          initial={reduced ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.18 }} className="flex min-w-0 items-center gap-2">
          <AnimatedCheckbox checked={parameter.enabled}
            onChange={event => update(parameter.key, { enabled: event.target.checked })}
            aria-label={`Include parameter ${index + 1}`} />
          <Input value={parameter.name} aria-label={`Parameter name ${index + 1}`} placeholder="Name"
            onChange={event => update(parameter.key, { name: event.target.value })}
            className="min-w-0 flex-1 font-mono text-xs" />
          <Input value={parameter.value} aria-label={`Parameter value ${index + 1}`} placeholder="Value"
            onChange={event => update(parameter.key, { value: event.target.value })}
            className="min-w-0 flex-1 font-mono text-xs" />
          <Button variant="ghost" size="icon-sm" disabled={disabled}
            aria-label={`Remove parameter ${index + 1}`}
            onClick={() => onChange(parameters.filter(item => item.key !== parameter.key))}>
            <X className="size-3.5" aria-hidden />
          </Button>
        </motion.div>
      ))}
      </div>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onChange([
        ...parameters, { key: crypto.randomUUID(), name: "", value: "", enabled: true },
      ])}><Plus className="size-3.5" aria-hidden /> Add parameter</Button>
      <p className="text-xs text-fg-muted">Added to the path when sent. Unchecked and unnamed parameters are skipped.</p>
    </fieldset>
  );
}
