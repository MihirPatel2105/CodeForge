"use client";

import { JsonViewer } from "@/components/ui/arc/json-viewer";
import { ResponseBody } from "./response-body";

export function JsonResponse({ body, pending }: { body: string; pending: boolean }) {
  let value: unknown;
  try { value = JSON.parse(body); }
  catch { return <ResponseBody text={body} pending={pending} />; }
  return <div className="mt-4 min-w-0" inert={pending}><JsonViewer data={value} rootName="response" defaultExpandDepth={2} maxHeight={420} label="Response JSON" /></div>;
}
