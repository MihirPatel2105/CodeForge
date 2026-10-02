"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";

/** Refresh visible operational views without overlapping requests or stale commits. */
export function useAdminResource<T>(fetcher: () => Promise<T>, interval = 60000) {
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const generation = useRef(0);
  const pending = useRef<number | null>(null);
  const refresh = useCallback(async () => {
    const current = generation.current;
    if (pending.current === current) return;
    pending.current = current;
    setLoading(true);
    try {
      const result = await fetcher();
      if (current !== generation.current) return;
      setData(result); setError(null); setUpdatedAt(new Date().toISOString());
    } catch (err) {
      if (current !== generation.current) return;
      if (err instanceof ApiError && err.status === 401) router.replace("/login");
      else if (err instanceof ApiError && err.status === 403 && err.code !== "admin_verification_required") router.replace("/projects");
      else setError(err instanceof ApiError ? err.message : "Could not refresh this view. Try again.");
    } finally {
      if (current === generation.current) { pending.current = null; setLoading(false); }
    }
  }, [fetcher, router]);
  useEffect(() => {
    generation.current += 1;
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, interval);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { generation.current += 1; clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh, interval]);
  return { data, error, loading, refresh, updatedAt };
}
