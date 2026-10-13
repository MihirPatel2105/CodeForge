"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

const STORAGE_KEY = "codeforge-desktop-recommendation-dismissed";

export function DesktopRecommendation() {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try { setDismissed(sessionStorage.getItem(STORAGE_KEY) === "1"); }
    catch { setDismissed(false); }
  }, []);

  function dismiss() {
    setDismissed(true);
    try { sessionStorage.setItem(STORAGE_KEY, "1"); }
    catch { /* Dismissal still works when browser storage is unavailable. */ }
  }

  if (dismissed) return null;
  return (
    <aside aria-label="Screen size recommendation" className="border-b border-border bg-bg px-3 py-3 md:hidden">
      <Notice variant="info" title="Desktop recommended" className="relative pr-11">
        <p>For the best experience, use CodeForge on a desktop or laptop. You can still browse on mobile.</p>
        <Button type="button" variant="ghost" size="icon-sm" onClick={dismiss}
          aria-label="Dismiss desktop recommendation" className="absolute right-2 top-2">
          <X data-icon="inline-start" />
        </Button>
      </Notice>
    </aside>
  );
}
