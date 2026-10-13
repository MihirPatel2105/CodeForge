"use client";

// Adapted from Vengeance UI. MIT attribution: docs/vendor/vengeance-ui.md.
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CopyFeedback } from "@/components/ui/copy-feedback";

export function shareableApiUrl(value: string) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return `${url.origin}${url.pathname}`;
  } catch { return null; }
}

export function ShareSheet({ url }: { url: string }) {
  const address = shareableApiUrl(url);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nativeShare, setNativeShare] = useState(false);
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qr = useRef<HTMLDivElement>(null);
  useEffect(() => { setNativeShare(typeof navigator.share === "function"); }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { setCopied(false); setMessage(""); }, [url]);
  if (!address) return null;
  async function copy() {
    try {
      await navigator.clipboard.writeText(address!); setCopied(true); setMessage("");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch { setMessage("Couldn't copy the address. Select and copy the link above."); }
  }
  async function share() {
    try { await navigator.share({ title: "CodeForge API", url: address! }); }
    catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setMessage("Sharing isn't available here. Copy the link instead."); }
  }
  function download() {
    const svg = qr.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = objectUrl; link.download = "codeforge-api-qr.svg"; link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
  return <Dialog open={open} onOpenChange={value => { setOpen(value); setMessage(""); setCopied(false); }}>
    <DialogTrigger render={<Button variant="outline" size="sm" />}><Share2 data-icon="inline-start" />Share API address</DialogTrigger>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
      <DialogHeader><DialogTitle>Share API address</DialogTitle><DialogDescription>Share the address or download its QR code. Recipients still need an API key to make requests.</DialogDescription></DialogHeader>
      <p className="select-all break-all rounded-xl border border-border bg-bg p-3 font-mono text-xs text-fg" aria-label="Shared API address">{address}</p>
      <div ref={qr} className="cf-share-qr"><QRCodeSVG value={address} size={160} marginSize={4} bgColor="#ffffff" fgColor="#000000" title="QR code for the API address" /></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void copy()} aria-label={copied ? "API address copied" : "Copy API address"}><CopyFeedback copied={copied} label="Copy link" /></Button>
        <Button variant="outline" onClick={download}><Download data-icon="inline-start" />Download QR</Button>
        {nativeShare && <Button variant="outline" onClick={() => void share()}><Share2 data-icon="inline-start" />Share…</Button>}
      </div>
      <p role="status" className="text-xs leading-5 text-fg-muted">{message || (copied ? "Address copied." : "")}</p>
    </DialogContent>
  </Dialog>;
}
