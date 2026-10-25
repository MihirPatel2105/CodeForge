"use client";

import type { ComponentProps, ReactNode } from "react";

export function SettingsPanel({ children, className = "", ...props }: ComponentProps<"section">) {
  return <section className={`settings-premium-panel ${className}`} {...props}><div className="settings-panel-surface">{children}</div></section>;
}

export function SettingsRail({ children }: { children: ReactNode }) {
  return <aside className="settings-premium-rail"><p className="settings-rail-label">Settings</p>{children}<p className="settings-rail-note">Manage your account<br />in one place.</p></aside>;
}
