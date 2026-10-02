"use client";
import { useEffect, useState } from "react";

export function useAdminFilters<T extends Record<string, string>>(defaults: T) {
  const [filters, setFilters] = useState<T>(defaults);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const restore = () => {
      const search = new URLSearchParams(window.location.search);
      setFilters(Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, search.get(key) ?? value])) as T);
      setReady(true);
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [defaults]);
  useEffect(() => {
    if (!ready) return;
    const search = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) search.set(key, value); });
    const next = `${window.location.pathname}${search.size ? `?${search}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }, [filters, ready]);
  return { filters, setFilters, ready };
}
