"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PreviewOperation } from "@/lib/types";

type Language = "cURL" | "Node.js" | "Python";

function requestCode(language: Language, url: string, operation: PreviewOperation): string {
  const endpoint = `${url}${operation.path}`;
  const body = operation.has_body ? JSON.stringify(operation.example_body ?? {}, null, 2) : null;
  if (language === "cURL") {
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

export function PublishGuide({ url, status, operations, onCopy }: {
  url: string;
  status: string;
  operations: PreviewOperation[];
  onCopy: (value: string) => void;
}) {
  const [selected, setSelected] = useState(0);
  const [language, setLanguage] = useState<Language>("cURL");
  const operation = operations[selected];
  const snippet = operation ? requestCode(language, url, operation) : "";

  return (
    <section className="space-y-5 border-t border-border pt-6" aria-labelledby="publish-guide-heading">
      <h3 id="publish-guide-heading" className="font-display text-[20px] font-[650] text-fg">How to use your published API</h3>
      <ol className="space-y-4 text-[13px] leading-6 text-fg-muted">
        <li><strong className="text-fg">1. Save the key.</strong> It is shown once. Store it as <code>CODEFORGE_API_KEY</code> in your server environment; never put it in React or other browser code. For a local cURL test, run <code>export CODEFORGE_API_KEY=&apos;your-key&apos;</code> in your terminal.</li>
        <li><strong className="text-fg">2. Pick an endpoint.</strong> Choose a route below. If its path contains braces, replace them with a real ID from a create response.</li>
        <li><strong className="text-fg">3. Copy a request.</strong> Use cURL to test it, or Node.js/Python code in your backend. Send and receive JSON.</li>
        <li><strong className="text-fg">4. Connect your app.</strong> Let your frontend call your backend, and let that backend call this URL with the key. No source download is needed to use the published API.</li>
      </ol>
      {operations.length ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <p className="text-[12px] font-[700] text-fg">Endpoints</p>
            <div className="mt-2 max-h-72 space-y-1 overflow-y-auto" role="group" aria-label="Published endpoints">
              {operations.map((item, index) => (
                <button key={`${item.method}-${item.path}`} type="button" onClick={() => setSelected(index)} aria-pressed={selected === index}
                  className={`flex w-full min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left font-mono text-[11px] ${selected === index ? "border-accent-bd bg-accent-soft text-fg" : "border-border bg-bg text-fg-muted hover:text-fg"}`}>
                  <span className="w-12 shrink-0 font-[700] text-accent">{item.method}</span><span className="truncate">{item.path}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-[700] text-fg">{operation.summary || `${operation.method} ${operation.path}`}</p>
            {operation.path.includes("{") && <p className="mt-1 text-[12px] text-fg-muted">Replace the value in braces before running this request.</p>}
            {operation.has_body && <p className="mt-1 text-[12px] text-fg-muted">Example JSON body is included below.</p>}
            {language === "Python" && <p className="mt-1 text-[12px] text-fg-muted">Install the HTTP client with <code>pip install requests</code>.</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(["cURL", "Node.js", "Python"] as const).map((item) => (
                <Button key={item} type="button" size="sm" variant={language === item ? "default" : "outline"} onClick={() => setLanguage(item)}>{item}</Button>
              ))}
              <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => onCopy(snippet)} aria-label="Copy request example"><Copy className="h-3.5 w-3.5" aria-hidden /> Copy</Button>
            </div>
            <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-term-bg p-4 font-mono text-[11px] leading-5 text-term-fg">{snippet}</pre>
            {operation.example_response != null && <div className="mt-3"><p className="text-[12px] font-[700] text-fg">Example response shape</p><pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-border bg-bg p-3 font-mono text-[11px] text-fg-muted">{JSON.stringify(operation.example_response, null, 2)}</pre></div>}
          </div>
        </div>
      ) : <p className="text-[12px] text-fg-muted">Endpoint examples are unavailable. Open Try API to inspect the generated routes.</p>}
      <p className="text-[12px] text-fg-muted">Status: {status} · Limit: 60 requests per minute · Your CodeForge backend and Docker host must stay online. Unpublishing deletes hosted data.</p>
      {url.startsWith("http://localhost") && <p className="text-[12px] text-warn">This URL works only on this computer. External apps need CodeForge configured with a public HTTPS backend URL.</p>}
    </section>
  );
}
