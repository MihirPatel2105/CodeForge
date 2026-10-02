import type { ReactNode } from "react";
import { AdminAccessGuard } from "@/components/admin/admin-access-guard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminAccessGuard>{children}</AdminAccessGuard>;
}
