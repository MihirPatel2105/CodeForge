"use client";

import { useState } from "react";
import { AnimatedDisclosure } from "@/components/dashboard/animated-disclosure";
import { Button } from "@/components/ui/button";
import { CopyFeedback } from "@/components/ui/copy-feedback";
import type { PreviewOperation } from "@/lib/types";

type Language = "cURL" | "Node.js" | "Python";
type Shell = "Bash / zsh" | "PowerShell";

function requestCode(language: Language, shell: Shell, url: string, operation: PreviewOperation): string {
  const endpoint = `${url}${operation.path}`;
  const body = operation.has_body ? JSON.stringify(operation.example_body ?? {}, null, 2) : null;
  if (language === "cURL") {
    if (shell === "PowerShell") {
      const lines = [
        `Invoke-RestMethod -Method ${operation.method} -Uri '${endpoint}'`,
        '  -Headers @{ Authorization = "Bearer $env:CODEFORGE_API_KEY" }',
      ];
      if (body) lines.push(`  -ContentType 'application/json' -Body @'\n${body}\n'@`);
      return lines.join(" `\n");
    }
    const lines = [
      `curl -X ${operation.method} "${endpoint}"`,
      '  -H "Authorization: Bearer $CODEFORGE_API_KEY"',
    ];
    if (body) lines.push('  -H "Content-Type: application/json"', `  -d '${JSON.stringify(operation.example_body ?? {})}'`);
    return lines.join(" \\\n");
  }
  if (language === "Node.js") {
    return `const response = await fetch(\`${endpoint}\`, {
  method: "${operation.method}",
  headers: {
    Authorization: \`Bearer \${process.env.CODEFORGE_API_KEY}\`,${body ? '\n    "Content-Type": "application/json",' : ""}
  },${body ? `\n  body: JSON.stringify(${body}),` : ""}
});
console.log(response.status, await response.text());`;
  }
  return `import json
import os
import requests

response = requests.request(
    "${operation.method}",
    "${endpoint}",
    headers={"Authorization": f"Bearer {os.environ['CODEFORGE_API_KEY']}"},${body ? `\n    json=json.loads(${JSON.stringify(JSON.stringify(operation.example_body ?? {}))}),` : ""}
)
print(response.status_code, response.text)`;
}

export function PublishGuide({ url, status, apiKey, operations, copied, onCopy }: {
  url: string;
  status: string;
  apiKey: string | null;
  operations: PreviewOperation[];
  copied: string | null;
  onCopy: (value: string, label: string) => void;
}) {
  const [selected, setSelected] = useState(0);
  const [language, setLanguage] = useState<Language>("cURL");
  const [shell, setShell] = useState<Shell>("Bash / zsh");
  const localOnly = url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1");
  const setupCommand = shell === "PowerShell"
    ? `$env:CODEFORGE_API_KEY='${apiKey ?? "PASTE_KEY_HERE"}'`
    : `export CODEFORGE_API_KEY='${apiKey ?? "PASTE_KEY_HERE"}'`;
  const visibleSetupCommand = shell === "PowerShell"
    ? "$env:CODEFORGE_API_KEY='PASTE_KEY_HERE'"
    : "export CODEFORGE_API_KEY='PASTE_KEY_HERE'";
  const operation = operations[selected];
  const snippet = operation ? requestCode(language, shell, url, operation) : "";
  const requestCopyId = `request-${selected}-${language}-${shell}`;

  return (
    <section className="min-w-0 rounded-3xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="publish-guide-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="publish-guide-heading" className="font-display text-[21px] font-[650] text-fg">Make a request</h3>
        <p className="text-[13px] leading-5 text-fg-muted">Set your key, choose an endpoint, then copy an example.</p>
      </div>
      <div className="mt-5 rounded-lg border border-border bg-bg p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] font-[700] text-fg">1. Set your key in a terminal</p>
          <div className="flex gap-1" role="group" aria-label="Choose terminal shell">
            {(["Bash / zsh", "PowerShell"] as const).map((option) => <button key={option} type="button" onClick={() => setShell(option)} aria-pressed={shell === option} className={`rounded-md px-2.5 py-1 text-[11px] font-[650] transition-[color,background-color,transform] duration-200 hover:-translate-y-0.5 active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none ${shell === option ? "bg-accent-soft text-accent" : "text-fg-muted hover:bg-surface hover:text-fg"}`}>{option}</button>)}
          </div>
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
          <code key={shell} className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-term-bg px-3 py-2 font-mono text-[11px] text-term-fg motion-safe:animate-[cfFade_220ms_ease-out]">{visibleSetupCommand}</code>
          <Button type="button" size="sm" variant="outline" onClick={() => onCopy(setupCommand, "setup")} aria-label={copied === "setup" ? "Terminal setup copied" : "Copy terminal setup"}><CopyFeedback copied={copied === "setup"} label={apiKey ? "Copy with key" : "Copy"} /></Button>
        </div>
      </div>
      {operations.length ? (
        <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(230px,0.35fr)_minmax(0,0.65fr)]">
          <div className="min-w-0">
            <p className="text-[12px] font-[700] text-fg">2. Choose an endpoint</p>
            <div className="mt-2 flex max-h-56 flex-wrap gap-1.5 overflow-y-auto lg:flex-col lg:flex-nowrap" role="group" aria-label="Published endpoints">
              {operations.map((item, index) => (
                <button key={`${item.method}-${item.path}`} type="button" onClick={() => setSelected(index)} aria-pressed={selected === index}
                  className={`inline-flex max-w-full min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left font-mono text-[11px] transition-[color,background-color,border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none lg:w-full ${selected === index ? "border-accent-bd bg-accent-soft text-fg shadow-[inset_3px_0_0_var(--accent)]" : "border-border bg-bg text-fg-muted hover:border-accent-bd hover:bg-accent-soft/30 hover:text-fg"}`}>
                  <span className="shrink-0 font-[700] text-accent">{item.method}</span><span className="truncate">{item.path}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="min-w-0 lg:border-l lg:border-border lg:pl-5">
            <p className="text-[12px] font-[700] text-fg">3. Copy the request · {operation.summary || `${operation.method} ${operation.path}`}</p>
            {operation.path.includes("{") && <p className="mt-1 text-[12px] text-fg-muted">Replace the value in braces before running this request.</p>}
            {operation.has_body && <p className="mt-1 text-[12px] text-fg-muted">Example JSON body is included below.</p>}
            {language === "Python" && <p className="mt-1 text-[12px] text-fg-muted">Install the HTTP client with <code>pip install requests</code>.</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(["cURL", "Node.js", "Python"] as const).map((item) => (
                <Button key={item} type="button" size="sm" variant={language === item ? "default" : "outline"} aria-pressed={language === item} onClick={() => setLanguage(item)}>{item === "cURL" && shell === "PowerShell" ? "PowerShell" : item}</Button>
              ))}
              <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => onCopy(snippet, requestCopyId)} aria-label={copied === requestCopyId ? "Request example copied" : "Copy request example"}><CopyFeedback copied={copied === requestCopyId} label="Copy" /></Button>
            </div>
            <pre key={requestCopyId} className="mt-2 max-h-80 min-h-32 overflow-auto rounded-lg bg-term-bg p-4 font-mono text-[11px] leading-5 text-term-fg motion-safe:animate-[cfFade_220ms_ease-out]">{snippet}</pre>
            {operation.example_response != null && <AnimatedDisclosure title="Example response shape" className="mt-3"><pre className="max-h-48 overflow-auto font-mono text-[11px] text-fg-muted">{JSON.stringify(operation.example_response, null, 2)}</pre></AnimatedDisclosure>}
          </div>
        </div>
      ) : <p className="mt-5 text-[12px] text-fg-muted">Endpoint examples are unavailable. Open Try API to inspect the generated routes.</p>}
      <div className="mt-5 grid items-start gap-3 border-t border-border pt-5 md:grid-cols-2">
        <AnimatedDisclosure title="Setup instructions">
          <ol className="list-decimal space-y-2 pl-5">
            <li>{apiKey ? "Copy the setup command above; it includes the new key." : "Replace PASTE_KEY_HERE with your saved key. If you lost it, rotate the key in Connection details."} Run it, then use the same Terminal window for the request.</li>
            <li>Copy the terminal request example and edit its values before running it. Replace names in braces, such as <code>{"{contact_id}"}</code>, with a real ID.</li>
            <li>For your app, use the Node.js or Python example in its backend. Store the key in the backend environment, never in browser or React code.</li>
          </ol>
        </AnimatedDisclosure>
        <AnimatedDisclosure title="Getting a 404 response?">
          <p>Check that the base URL is correct, then choose a path from the endpoint list above. If you use a local URL, run the request on the same device as CodeForge and make sure its backend is running. A downloaded API runs separately and does not use this published URL or key.</p>
        </AnimatedDisclosure>
      </div>
      <div className="mt-4 space-y-2">
        {localOnly && <p className="rounded-lg border border-warn-bd bg-warn-soft px-4 py-3 text-[12px] leading-5 text-fg">This URL uses <code>localhost</code>, so it is reachable only from the device running CodeForge. To call it from another device or a hosted app, CodeForge needs a publicly reachable HTTPS backend URL.</p>}
        <p className="text-[12px] leading-5 text-fg-muted">Status: {status} · 60 requests per minute. Keep your CodeForge backend and Docker host online; unpublishing deletes hosted data.</p>
      </div>
    </section>
  );
}
