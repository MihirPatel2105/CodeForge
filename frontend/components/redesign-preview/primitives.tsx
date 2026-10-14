"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, Check, Copy, Download, FileCode2, WrapText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AnimatedArrow } from "@/components/ui/enhancements/animated-icons";
import { href } from "./data";

export function PreviewLink({ to, children, primary = false, className = "" }: { to: string; children: ReactNode; primary?: boolean; className?: string }) {
  return <Link href={href(to)} className={`rp-link-button ${primary ? "rp-primary" : ""} ${className}`}>{children}<AnimatedArrow /></Link>;
}
export function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children?: ReactNode }) {
  return <header className="rp-page-heading"><div><p className="rp-eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="rp-description">{description}</p>}</div>{children && <div className="rp-heading-actions">{children}</div>}</header>;
}
export function Status({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" }) {
  return <Badge variant="outline" className={`rp-status rp-status-${tone}`}><span aria-hidden />{children}</Badge>;
}
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <div className={`rp-reveal ${className}`} style={{ animationDelay: `${delay}s` }}>{children}</div>;
}
export function PreviewModal({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (value: boolean) => void; title: string; description: string; children: ReactNode }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="rp-modal"><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription>{children}</DialogContent></Dialog>;
}
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <Button variant="outline" size="sm" aria-label={copied ? "Copied" : failed ? "Copy failed; try again" : label} onClick={async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setFailed(false); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), 1800); }
    catch { setFailed(true); }
  }}>{copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}{copied ? "Copied" : failed ? "Try copying again" : label}</Button>;
}
export function downloadText(name: string, value: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function DownloadButton({ name, value, label = "Download" }: { name: string; value: string; label?: string }) {
  return <Button variant="outline" onClick={() => downloadText(name, value)}><Download data-icon="inline-start" />{label}</Button>;
}
export function CodePane({ name, code, highlight }: { name: string; code: string; highlight?: number }) {
  const [wrap, setWrap] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!highlight || !viewport.current) return;
    const line = viewport.current.querySelector<HTMLElement>(`[data-line="${highlight}"]`);
    if (line) viewport.current.scrollTop = Math.max(0, line.offsetTop - 90);
  }, [highlight, name]);
  return <div className="rp-code-pane"><div className="rp-code-toolbar"><span><FileCode2 size={16} aria-hidden />{name}</span><div><Button variant="ghost" size="sm" aria-pressed={wrap} onClick={() => setWrap(!wrap)}><WrapText data-icon="inline-start" />Wrap</Button><CopyButton text={code} /></div></div>
    <div className="rp-code-scroll" ref={viewport} tabIndex={0} aria-label={`${name} code, scroll to read all lines`} data-lenis-prevent><pre className={wrap ? "rp-wrap" : ""}><code>{code.split("\n").map((line, index) => <span className={`rp-code-line ${highlight === index + 1 ? "rp-highlight-line" : ""}`} data-line={index + 1} key={index}><span aria-hidden className="rp-line-number">{index + 1}</span><span>{line || " "}</span></span>)}</code></pre></div>
  </div>;
}
export function InlineNote({ children }: { children: ReactNode }) { return <p className="rp-inline-note">{children}</p>; }
export function TextLink({ to, children }: { to: string; children: ReactNode }) { return <Link className="rp-text-link" href={href(to)}>{children}<ArrowUpRight size={14} aria-hidden /></Link>; }
