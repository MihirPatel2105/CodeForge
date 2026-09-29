"use client";

import { useRef, type ComponentProps, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type RunFlowLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

export function RunFlowLink({ href, onClick, target, ...props }: RunFlowLinkProps) {
  const router = useRouter();
  const leaving = useRef(false);

  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || target === "_blank") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    event.preventDefault();
    if (leaving.current) return;
    leaving.current = true;
    const main = document.querySelector<HTMLElement>("[data-run-flow-page]");
    main?.classList.add("cf-run-flow-exit");
    window.setTimeout(() => {
      router.push(href);
      window.setTimeout(() => main?.classList.remove("cf-run-flow-exit"), 1500);
    }, 150);
  }

  return <Link href={href} onClick={navigate} target={target} {...props} />;
}
