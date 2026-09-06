import Link from "next/link";
import { PrivacySettingsLink } from "@/components/privacy-settings-link";
import { getOperatorSentence, legalConfig } from "@/lib/legal-config";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-zinc-950 px-4 py-5 text-white sm:px-6">
      <div className="mx-auto grid w-full max-w-6xl gap-3 text-center text-xs font-bold text-white/62 sm:grid-cols-[1fr_auto] sm:text-left">
        <div className="grid gap-1">
          <p>&copy; {year} Spotnera</p>
          <p>{getOperatorSentence()}</p>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 sm:justify-start">
            {legalConfig.organizationNumber ? (
              <span>Org. no. {legalConfig.organizationNumber}</span>
            ) : null}
            {legalConfig.country ? <span>{legalConfig.country}</span> : null}
          </div>
        </div>
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
