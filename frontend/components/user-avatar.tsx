"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { UserRound, Settings } from "lucide-react";
import { toast } from "sonner";
import { UserMenu, type ThemePreference } from "@/components/ui/arc/user-menu";
import { useSession } from "@/lib/use-current-user";
import { api, ApiError, clearToken } from "@/lib/api";

export function UserAvatar({ initials, name, className }: { initials: string; name: string; className?: string }) {
  const router = useRouter();
  const { user } = useSession();
  const { theme, forcedTheme, setTheme } = useTheme();
  async function signOut() {
    try { await api.signOut(); }
    catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) {
        // A response can be lost after revocation; confirm before reporting a failure.
        try { await api.me(); }
        catch (checkError) {
          if (checkError instanceof ApiError && checkError.status === 401) { clearToken(); router.replace("/login"); return; }
        }
        toast.error("Couldn't confirm sign-out. Check your connection, then try again.");
        return;
      }
    }
    clearToken();
    router.replace("/login");
  }
  return <UserMenu className={className} user={{ name: name || initials, email: user?.email ?? "" }} showTheme={!forcedTheme} theme={(theme === "dark" || theme === "system" ? theme : "light") as ThemePreference} onThemeChange={setTheme} items={[
    { label: "Profile", icon: <UserRound size={16} />, onSelect: () => router.push("/profile") },
    { label: "Settings", icon: <Settings size={16} />, onSelect: () => router.push("/profile/settings") },
  ]} onSignOut={signOut} />;
}
