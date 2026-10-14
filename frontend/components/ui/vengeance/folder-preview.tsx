"use client";

// Adapted from Vengeance UI's folder/paper preview. MIT license: docs/vendor/vengeance-ui.md.
import { FileCode2 } from "lucide-react";

export function FolderPreview({ label, detail }: { label: string; detail: string }) {
  return (
    <span className="vui-folder-preview">
      <span className="vui-folder" aria-hidden>
        <span className="vui-folder-back" />
        {["left", "right"].map(position => (
          <span key={position} className={`vui-folder-paper vui-folder-paper-${position}`}>
            <FileCode2 size={12} />
          </span>
        ))}
        <span className="vui-folder-cover" />
      </span>
      <span className="min-w-0"><span className="block text-xs font-semibold text-fg-muted">{label}</span>
        <span className="mt-1 block text-xs text-fg-faint">{detail}</span></span>
    </span>
  );
}
