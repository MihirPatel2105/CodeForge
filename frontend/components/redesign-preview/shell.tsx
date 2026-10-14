"use client";

import { LogoLockup } from "@/components/brand/logo-lockup";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, BookOpen, Box, CircleHelp, Command, FileCode2, Folder, LayoutDashboard, Menu, Search, Settings2, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PreviewModal } from "./primitives";
import { href, screenGroups } from "./data";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href={href()} className="rp-brand" aria-label="CodeForge preview home"><LogoLockup className="rp-logo" />{!compact && <span className="rp-brand-edition">Studio</span>}</Link>;
}
export function PreviewBar({ screen }: { screen: string }) {
  return <div className="rp-preview-bar"><span><span className="rp-preview-dot" />Design preview <span className="rp-preview-meta">/ Fictional data · no account changes</span></span><label><span className="sr-only">Preview screen</span><select aria-label="Preview screen" value={screen} onChange={event => { window.location.href = href(event.target.value); }}>{screenGroups.map(group => <optgroup key={group.label} label={group.label}>{group.screens.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</optgroup>)}</select></label></div>;
}
export function PublicShell({ screen, children }: { screen: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <><PreviewBar screen={screen} /><header className="rp-public-header"><Brand /><nav className="rp-public-nav" aria-label="Public navigation"><Link href={href("how-it-works")}>How it works</Link><Link href={href("projects")}>Workspace</Link><Link href={href("about")}>About</Link></nav><div className="rp-public-actions"><Link href={href("login")}>Sign in</Link><Link className="rp-link-button rp-primary" href={href("project")}>Start building<ArrowUpRight size={15} aria-hidden /></Link><Button size="icon" variant="ghost" className="rp-mobile-menu" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu /></Button></div></header>
    <PreviewModal open={open} onOpenChange={setOpen} title="Explore CodeForge" description="Choose a page in the design preview."><nav className="rp-modal-links" aria-label="Mobile public navigation">{[["home", "Home"], ["how-it-works", "How it works"], ["projects", "Workspace"], ["about", "About"], ["faq", "FAQ"]].map(([to, label]) => <Link onClick={() => setOpen(false)} href={href(to)} key={to}>{label}<ArrowUpRight size={16} /></Link>)}</nav></PreviewModal>
    <main id="rp-main">{children}</main><footer className="rp-footer"><div><Brand compact /><p>A thoughtful path from idea to API.</p></div><div>{[["how-it-works", "How it works"], ["faq", "FAQ"], ["contact", "Contact"], ["privacy", "Privacy"], ["terms", "Terms"]].map(([to, label]) => <Link href={href(to)} key={to}>{label}</Link>)}</div><div className="rp-footer-bottom"><span>© 2026 CodeForge</span><span>Preview interactions adapted from <a href="https://skiper-ui.com">Skiper UI</a> & <a href="https://www.vengenceui.com">Vengeance UI</a>.</span><span>Plan. Build. Review. Test.</span></div></footer></>;
}
const links = [{ to: "projects", label: "Projects", Icon: Folder }, { to: "run", label: "Run workspace", Icon: Box }, { to: "try", label: "API playground", Icon: FileCode2 }, { to: "use", label: "Integration kit", Icon: BookOpen }];
const adminLinks = [["admin", "Overview"], ["admin/users", "Users"], ["admin/runs", "Runs"], ["admin/deployments", "Deployments"], ["admin/monitoring", "Monitoring"], ["admin/quality", "Quality"], ["admin/incidents", "Incidents"], ["admin/audit", "Audit log"], ["admin/system", "System health"]];

export function WorkspaceShell({ screen, children }: { screen: string; children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const admin = screen.startsWith("admin");
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(current => !current); } };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, []);
  const navigation = <><div className="rp-workspace-switch"><span className="rp-workspace-icon">C</span><div><strong>Personal workspace</strong><span>Design exploration</span></div></div><p className="rp-nav-label">{admin ? "Administration" : "Workspace"}</p><nav aria-label="Workspace navigation">{admin ? adminLinks.map(([to, label]) => <Link key={to} href={href(to)} onClick={() => setMenu(false)} aria-current={screen === to ? "page" : undefined}><LayoutDashboard size={17} />{label}</Link>) : links.map(({ to, label, Icon }) => <Link key={to} href={href(to)} onClick={() => setMenu(false)} aria-current={screen === to || (to === "projects" && screen === "project") || (to === "run" && screen === "run/live") ? "page" : undefined}><Icon size={17} />{label}{to === "projects" && <span className="rp-nav-count">4</span>}</Link>)}</nav><div className="rp-sidebar-bottom"><p className="rp-nav-label">Account</p><nav aria-label="Account navigation"><Link href={href("profile")} onClick={() => setMenu(false)} aria-current={screen === "profile" ? "page" : undefined}><UserRound size={17} />Profile</Link><Link href={href("settings")} onClick={() => setMenu(false)} aria-current={screen.startsWith("settings") ? "page" : undefined}><Settings2 size={17} />Settings</Link><Link href={href(admin ? "projects" : "admin")} onClick={() => setMenu(false)}><ShieldCheck size={17} />{admin ? "Back to workspace" : "Admin preview"}</Link><Link href={href("faq")} onClick={() => setMenu(false)}><CircleHelp size={17} />Help & resources</Link></nav><Link className="rp-account-chip" href={href("profile")}><span className="rp-avatar">D</span><span><strong>Demo account</strong><small>Preview workspace</small></span><ArrowUpRight size={14} /></Link></div></>;
  const results = screenGroups.flatMap(group => group.screens).filter(([, label]) => label.toLowerCase().includes(query.toLowerCase()));
  return <><PreviewBar screen={screen} /><div className="rp-workspace-shell"><aside className="rp-sidebar" data-lenis-prevent><Brand compact />{navigation}</aside><div className="rp-workspace-main"><header className="rp-workspace-header"><div><Button variant="ghost" size="icon" className="rp-mobile-menu" onClick={() => setMenu(true)} aria-label="Open workspace navigation"><Menu /></Button><span className="rp-breadcrumb">{admin ? "Administration" : "Workspace"}<span>/</span><strong>{screenGroups.flatMap(g => g.screens).find(([value]) => value === screen)?.[1] ?? "Overview"}</strong></span></div><div><button className="rp-search-trigger" onClick={() => setSearchOpen(true)}><Search size={15} /><span>Jump to anything</span><kbd>⌘ K</kbd></button><Link className="rp-avatar rp-header-avatar" aria-label="Open profile" href={href("profile")}>D</Link></div></header><main id="rp-main" className="rp-workspace-content">{children}</main><footer className="rp-workspace-footer"><span>CodeForge / Studio preview</span><span>Sample data. Real interactions.</span></footer></div></div>
    <PreviewModal open={menu} onOpenChange={setMenu} title="Your workspace" description="Navigate the CodeForge design preview."><div className="rp-mobile-sidebar">{navigation}</div></PreviewModal>
    <PreviewModal open={searchOpen} onOpenChange={value => { setSearchOpen(value); if (!value) setQuery(""); }} title="Go anywhere" description="Search preview screens. Tab to a result and press Enter to open."><div className="rp-command-input"><Search size={18} /><Input aria-label="Search preview screens" value={query} onChange={event => setQuery(event.target.value)} placeholder="Projects, settings, API playground…" /></div><div className="rp-command-results" data-lenis-prevent>{results.length ? results.map(([to, label]) => <Link key={to} href={href(to)} onClick={() => setSearchOpen(false)}><Command size={15} /><span>{label}</span><ArrowUpRight size={14} /></Link>) : <p>No screens match your search.</p>}</div></PreviewModal>
  </>;
}
