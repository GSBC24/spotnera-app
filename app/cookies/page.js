import Link from "next/link";
import { PrivacySettingsLink } from "@/components/privacy-settings-link";

const rows = [
  {
    category: "Necessary",
    provider: "Spotnera / Supabase",
    purpose: "Authentication sessions, security, user account access, owner dashboard access, reviews, favorites, and database-backed app features.",
    consent: "Required to provide requested service features.",
  },
  {
    category: "Necessary",
    provider: "Spotnera",
    purpose: "PWA service worker cache for offline fallback/static app assets, install-prompt dismissal, and saved privacy choice.",
    consent: "Required or preference-based for core app behavior and remembering the user's choice.",
  },
  {
    category: "Service request",
    provider: "Mapbox",
    purpose: "Map display, map tiles/styles, and business-owner address search. Mapbox receives technical request information when map/search features load.",
    consent: "Used to provide map/address features requested in the product, not used by Spotnera as analytics consent.",
  },
  {
    category: "Analytics",
    provider: "Google Analytics 4",
    purpose: "Product analytics such as page views and app events after the user grants analytics consent.",
    consent: "Optional. Disabled until accepted and can be withdrawn.",
  },
  {
    category: "First-party business analytics",
    provider: "Spotnera / Supabase",
    purpose: "Anonymous aggregate business engagement counters shown to business owners.",
    consent: "No device storage or direct customer identifiers are used by this event model.",
  },
];

export default function CookiesPage() {
  return (
    <main className="spotnera-owner-shell min-h-screen px-4 py-6 sm:px-6">
      <section className="mx-auto grid w-full max-w-5xl gap-4">
        <header className="spotnera-card rounded-[30px] p-5 sm:p-7">
          <p className="spotnera-kicker text-zinc-500">Cookie & tracking information</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Cookies and Storage</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Spotnera only starts Google Analytics after analytics consent. Necessary technologies remain available so the service works when analytics is rejected.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <PrivacySettingsLink className="spotnera-primary-action inline-flex min-h-10 items-center rounded-full px-4 text-xs" />
            <Link href="/privacy" className="spotnera-secondary-action inline-flex min-h-10 items-center px-4 text-xs">
              Privacy
            </Link>
            <Link href="/terms" className="spotnera-secondary-action inline-flex min-h-10 items-center px-4 text-xs">
              Terms
            </Link>
          </div>
        </header>

        <section className="spotnera-card overflow-hidden rounded-[30px] p-3">
          <div className="grid gap-3">
            {rows.map((row) => (
              <article key={`${row.category}-${row.provider}`} className="rounded-[22px] border border-zinc-200 bg-white/78 p-4">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_2fr_1.4fr]">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Category</p>
                    <p className="mt-1 text-sm font-bold text-zinc-950">{row.category}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Provider</p>
                    <p className="mt-1 text-sm font-bold text-zinc-950">{row.provider}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Purpose</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">{row.purpose}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Consent</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">{row.consent}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
