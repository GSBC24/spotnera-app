import { LogoutButton } from "@/components/logout-button";

export function HeaderLogout() {
  return (
    <LogoutButton
      className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-white/12 bg-white/10 px-3 text-xs font-bold text-white/78 transition hover:bg-white/16 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
      errorClassName="absolute right-0 top-full mt-2 w-48 rounded-xl border border-red-300/30 bg-red-950/90 px-2 py-1.5 text-right text-[11px] font-semibold text-red-200 shadow-xl"
      loadingChildren="Logging out..."
    />
  );
}
