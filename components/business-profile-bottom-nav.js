"use client";

import { useRouter } from "next/navigation";
import { SpotneraBottomNav } from "@/components/spotnera-bottom-nav";

export function BusinessProfileBottomNav({ isAuthenticated }) {
  const router = useRouter();

  function requireAuth(intent) {
    const destination = intent === "saved" ? "/?tab=saved" : intent === "business" ? "/owner" : "/me";
    router.push(`/?auth=1&next=${encodeURIComponent(destination)}`);
  }

  return (
    <SpotneraBottomNav
      activeTab=""
      isAuthenticated={isAuthenticated}
      onSaved={isAuthenticated ? undefined : () => requireAuth("saved")}
      onRequireAuth={requireAuth}
    />
  );
}
