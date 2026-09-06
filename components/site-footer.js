import Link from "next/link";
import { PrivacySettingsLink } from "@/components/privacy-settings-link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-zinc-950 px-4 py-5 text-white sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-bold text-white/62 sm:justify-between">
        <p>Spotnera</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/privacy" className="underline-offset-4 hover:text-white hover:underline">
            Privacy
          </Link>
          <Link href="/cookies" className="underline-offset-4 hover:text-white hover:underline">
            Cookies
          </Link>
          <Link href="/terms" className="underline-offset-4 hover:text-white hover:underline">
            Terms
          </Link>
          <PrivacySettingsLink className="underline-offset-4 hover:text-white hover:underline" />
        </nav>
      </div>
    </footer>
  );
}
