"use client";

import type { CSSProperties, ReactNode } from "react";

export function ProfilePanel({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <section className={`profile-premium-panel ${className}`} style={{ "--profile-delay": `${delay}s` } as CSSProperties}>{children}</section>;
}

export function ProfileIdentityCard({ children }: { children: ReactNode }) {
  return <div className="profile-identity-stage"><div className="profile-premium-identity">{children}</div></div>;
}
