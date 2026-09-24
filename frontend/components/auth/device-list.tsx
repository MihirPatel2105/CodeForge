"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Laptop, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, clearToken, getToken, ApiError } from "@/lib/api";
import type { DeviceResponse } from "@/lib/types";

export function DeviceList() {
  const router = useRouter();
  const [devices, setDevices] = useState<DeviceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setDevices(await api.devices());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your devices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getToken()) void refresh();
  }, [refresh]);

  async function endDevice(device: DeviceResponse) {
    setEnding(device.id);
    setError(null);
    try {
      await api.signOutDevice(device.id);
      if (device.current) {
        clearToken();
        router.replace("/login");
      } else {
        await refresh();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign out this device.");
    } finally {
      setEnding(null);
    }
  }

  return (
    <div className="border-t border-rule px-6 py-5">
      <div className="flex items-center gap-2 font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-fg-faint">
        <Laptop className="h-3.5 w-3.5" aria-hidden />
        Signed-in browsers
      </div>
      {loading ? <p className="mt-3 text-[12px] text-fg-muted">Loading devices…</p> : null}
      {!loading && devices.length === 0 ? (
        <p className="mt-3 text-[12px] leading-5 text-fg-muted">
          No tracked browser sessions yet. Sessions opened before this feature will not appear.
        </p>
      ) : null}
      <div className="mt-3 divide-y divide-rule">
        {devices.map((device) => (
          <div key={device.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="text-[13px] font-[600] text-fg">
                {device.label} {device.current ? <span className="text-accent">· this browser</span> : null}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-fg-muted">
                Last sign-in {new Date(device.last_seen_at).toLocaleString()} · IP {device.ip_address ?? "unavailable"}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={ending !== null}
              onClick={() => void endDevice(device)}
              className="h-9 rounded-[3px] text-[11px]"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" aria-hidden />
              {ending === device.id ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        ))}
      </div>
      {error ? <p role="alert" className="mt-3 text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}
