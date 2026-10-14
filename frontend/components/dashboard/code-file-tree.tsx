"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { LayoutGroup, motion } from "motion/react";
import { ChevronRight, FileCode2, Folder, FolderOpen } from "lucide-react";
import { MotionButton } from "@/components/ui/motion-button";
import { MotionCollapse } from "@/components/ui/motion-collapse";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { motionSpring } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";
import type { FileSnapshot } from "@/lib/run-reducer";

type Node = { kind: "folder"; path: string; name: string; children: Node[] }
  | { kind: "file"; path: string; name: string; file: FileSnapshot };
type Props = {
  files: FileSnapshot[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  revealRequestId?: number;
};

function groupFiles(files: FileSnapshot[]): Node[] {
  const root: Node[] = [];
  const folders = new Map<string, Extract<Node, { kind: "folder" }>>();
  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let children = root;
    for (let index = 0; index < parts.length - 1; index++) {
      const path = parts.slice(0, index + 1).join("/");
      let folder = folders.get(path);
      if (!folder) {
        folder = { kind: "folder", path, name: parts[index], children: [] };
        folders.set(path, folder);
        children.push(folder);
      }
      children = folder.children;
    }
    children.push({ kind: "file", path: file.path, name: parts.at(-1) ?? file.path, file });
  }
  return root;
}

export function CodeFileTree(props: Props) {
  const id = useId();
  const nodes = useMemo(() => groupFiles(props.files), [props.files]);
  return <LayoutGroup id={id}><FileNodes nodes={nodes} {...props} /></LayoutGroup>;
}

function FileNodes({ nodes, ...props }: Props & { nodes: Node[] }) {
  const reduced = useMotionPreference();
  return <ul className="flex min-w-0 flex-col gap-1 p-2">
    {nodes.map(node => node.kind === "folder"
      ? <FolderNode key={`folder:${node.path}`} node={node} {...props} />
      : <li key={`file:${node.path}`}>
        <MotionButton type="button" aria-label={`${node.path} ${node.file.status}`}
          aria-pressed={node.path === props.selectedPath} onClick={() => props.onSelect(node.path)}
          title={node.path} className={cn(
            "relative isolate flex w-full min-w-0 items-center gap-2 rounded-xl border border-transparent px-2 py-2 text-left font-mono text-[12px] text-fg-muted transition-colors hover:bg-surface hover:text-fg",
            node.path === props.selectedPath && "border-accent-bd font-bold text-accent",
          )}>
          {node.path === props.selectedPath && <motion.span layoutId="file-selection"
            transition={reduced ? { duration: 0 } : motionSpring}
            className="absolute inset-0 -z-10 rounded-xl bg-surface shadow-sm" aria-hidden />}
          <FileCode2 className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
          <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold", node.file.status === "new" ? "bg-ok-soft text-ok" : "bg-loop-soft text-loop")}>{node.file.status}</span>
        </MotionButton>
      </li>)}
  </ul>;
}

function FolderNode({ node, ...props }: Props & { node: Extract<Node, { kind: "folder" }> }) {
  const [open, setOpen] = useState(true);
  const id = useId();
  const reduced = useMotionPreference();
  useEffect(() => {
    if (props.selectedPath?.startsWith(`${node.path}/`)) setOpen(true);
  }, [props.selectedPath, props.revealRequestId, node.path]);
  const Icon = open ? FolderOpen : Folder;
  return <li className="min-w-0">
    <MotionButton type="button" aria-label={`Folder ${node.path}`} aria-expanded={open} aria-controls={id}
      onClick={() => setOpen(value => !value)}
      className="flex w-full min-w-0 items-center gap-1.5 rounded-lg px-2 py-2 text-left text-[12px] font-semibold text-fg-muted hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-accent">
      <motion.span initial={false} animate={{ rotate: open ? 90 : 0 }} transition={{ duration: reduced ? 0 : 0.16 }} className="inline-flex shrink-0" aria-hidden><ChevronRight className="size-3" /></motion.span>
      <Icon className="size-4 shrink-0" aria-hidden /><span className="truncate">{node.name}</span>
    </MotionButton>
    <MotionCollapse id={id} open={open} className="ml-2 border-l border-border">
      <FileNodes nodes={node.children} {...props} />
    </MotionCollapse>
  </li>;
}
