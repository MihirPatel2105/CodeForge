"use client";
import type { ReactNode } from "react";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuGroup, ContextMenuItem } from "@/components/ui/context-menu";
import { Popover, PopoverTrigger, PopoverContent, PopoverTitle } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Copy, Download, Link2 } from "lucide-react";
import { toast } from "sonner";

export function FileActions({ path, content, children }: { path: string; content: string | null; children: ReactNode }) {
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); toast.success("Copied to clipboard"); }
    catch { toast.error("Couldn’t copy. Try again."); }
  }
  function download() {
    if (content === null) return;
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = path.split("/").pop() || "code.txt";
    a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const actions = [
    { label: "Copy path", Icon: Link2, run: () => copy(path), disabled: false },
    { label: "Copy code", Icon: Copy, run: () => copy(content ?? ""), disabled: content === null },
    { label: "Download file", Icon: Download, run: download, disabled: content === null },
  ];
  return <div className="flex min-w-0 items-center gap-0.5">
    <ContextMenu><ContextMenuTrigger className="min-w-0 flex-1">{children}</ContextMenuTrigger>
      <ContextMenuContent><ContextMenuGroup>{actions.map(({ label, Icon, run, disabled }) => <ContextMenuItem key={label} onClick={run} disabled={disabled}><Icon aria-hidden />{label}</ContextMenuItem>)}</ContextMenuGroup></ContextMenuContent>
    </ContextMenu>
    <Popover><PopoverTrigger render={<Button variant="ghost" size="icon-sm" />} aria-label={`Actions for ${path}`}><MoreHorizontal aria-hidden /></PopoverTrigger>
      <PopoverContent align="end" className="w-48"><PopoverTitle className="truncate">{path}</PopoverTitle>{actions.map(({ label, Icon, run, disabled }) => <Button key={label} variant="ghost" size="sm" disabled={disabled} onClick={run} className="justify-start"><Icon aria-hidden />{label}</Button>)}</PopoverContent>
    </Popover>
  </div>;
}
