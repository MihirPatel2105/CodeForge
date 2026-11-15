"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { NAV_GROUPS, groupIsCurrent, type NavGroup } from "./nav-groups";

/** Hover intent: a short grace period so the pointer can travel from pill to panel. */
const HOVER_CLOSE_MS = 140;

/** Dropdown pills for the top bar: one panel open at a time, keyboard and pointer friendly. */
export function NavMenu({ pathname }: { pathname: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Hover opens a panel provisionally; a click pins it, so leaving with the pointer doesn't close it.
  const pinned = useRef(false);

  const close = useCallback(() => {
    pinned.current = false;
    setOpenId(null);
  }, []);
  const cancelClose = () => clearTimeout(closeTimer.current);
  const scheduleClose = () => {
    cancelClose();
    if (!pinned.current) closeTimer.current = setTimeout(close, HOVER_CLOSE_MS);
  };
  // A click that lands on a hover-opened panel pins it rather than closing it straight away.
  const toggle = (id: string) => {
    cancelClose();
    if (openId === id && pinned.current) return close();
    pinned.current = true;
    setOpenId(id);
  };

  // A new page closes whatever was open.
  useEffect(close, [pathname, close]);

  useEffect(() => {
    if (!openId) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [openId, close]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  return (
    <div ref={root} className="lh-menus">
      {NAV_GROUPS.map((group) => (
        <MenuGroup
          key={group.id}
          group={group}
          open={openId === group.id}
          current={groupIsCurrent(group, pathname)}
          onToggle={() => toggle(group.id)}
          onHoverOpen={() => {
            cancelClose();
            if (pinned.current && openId !== group.id) pinned.current = false;
            if (!pinned.current) setOpenId(group.id);
          }}
          onHoverLeave={scheduleClose}
          onClose={close}
        />
      ))}
    </div>
  );
}

interface MenuGroupProps {
  group: NavGroup;
  open: boolean;
  current: boolean;
  onToggle: () => void;
  onHoverOpen: () => void;
  onHoverLeave: () => void;
  onClose: () => void;
}

function MenuGroup({ group, open, current, onToggle, onHoverOpen, onHoverLeave, onClose }: MenuGroupProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = `lh-menu-${group.id}`;

  const links = () => Array.from(panel.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []);
  const focusLink = (index: number) => {
    const all = links();
    all[(index + all.length) % all.length]?.focus();
  };

  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    if (!open) onToggle();
    requestAnimationFrame(() => focusLink(0));
  };

  const onPanelKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = links().indexOf(document.activeElement as HTMLAnchorElement);
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      trigger.current?.focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusLink(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusLink(index - 1);
    }
  };

  // Pointer hover opens on devices that can hover; touch relies on the click toggle.
  const hover = (handler: () => void) => (event: React.PointerEvent) => {
    if (event.pointerType === "mouse") handler();
  };

  return (
    <div
      className="lh-menu"
      onPointerEnter={hover(onHoverOpen)}
      onPointerLeave={hover(onHoverLeave)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          onClose();
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="lh-pill lh-menu-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        data-current={current ? "" : undefined}
        onClick={onToggle}
        onKeyDown={onTriggerKey}
      >
        {group.label}
        <ChevronDown className="lh-menu-chevron" aria-hidden />
      </button>
      <div
        ref={panel}
        id={panelId}
        className="lh-menu-panel"
        data-open={open ? "" : undefined}
        data-columns={group.columns}
        hidden={!open}
        onKeyDown={onPanelKey}
      >
        <ul>
          {group.links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} onClick={onClose}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
