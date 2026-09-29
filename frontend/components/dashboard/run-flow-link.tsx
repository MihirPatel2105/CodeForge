import { type ComponentProps } from "react";
import Link from "next/link";

type RunFlowLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

export function RunFlowLink({ href, ...props }: RunFlowLinkProps) {
  return <Link href={href} {...props} />;
}
